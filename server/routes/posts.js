import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Post from "../models/Post.js";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import {
  populateConversation,
  populateMessage,
  ensureParticipant,
  updateConversationLastMessage,
  emitMessageEvent,
} from "../utils/chatHelpers.js";

const router = express.Router();

const ensureJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be defined in the environment");
  }
};

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    ensureJwtSecret();
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("❌ Post auth failed:", error?.message || error);
    return res.status(403).json({ error: "Invalid token" });
  }
};

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    console.error("❌ Posts route error:", error?.message || error);
    res.status(500).json({ error: "Something went wrong" });
  }
};

const formatUser = (userDoc) =>
  userDoc
    ? {
      id: userDoc._id.toString(),
      name: userDoc.name,
      email: userDoc.email,
      profile_photo: userDoc.profile_photo || null,
    }
    : null;

const formatPost = (postDoc, currentUserId) => {
  const likes = postDoc.likes || [];
  const comments = postDoc.comments || [];
  const sharedWith = postDoc.sharedWith || [];
  return {
    id: postDoc._id.toString(),
    content: postDoc.content,
    image: postDoc.image || null,
    createdAt: postDoc.createdAt,
    author: formatUser(postDoc.author),
    likesCount: likes.length,
    isLiked: likes.some((id) => id.toString() === currentUserId),
    comments: comments.map((comment) => ({
      id: comment._id.toString(),
      text: comment.text,
      createdAt: comment.createdAt,
      user: formatUser(comment.user),
    })),
    commentsCount: comments.length,
    sharesCount: postDoc.sharesCount || sharedWith.length || 0,
  };
};

const loadPost = async (postId) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return null;
  }

  return Post.findById(postId)
    .populate("author", "name email profile_photo")
    .populate("comments.user", "name email profile_photo");
};

router.get(
  "/feed",
  authenticate,
  asyncHandler(async (req, res) => {
    const currentUser = await User.findById(req.user.id).lean();
    const canSeeHidden = currentUser?.email === "aditya.verma2024@nst.rishihood.edu.in";

    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("author", "name email profile_photo isHidden")
      .populate("comments.user", "name email profile_photo");

    const filteredPosts = posts.filter(post => {
      if (!post.author) return false;
      if (post.author.isHidden && !canSeeHidden) return false;
      return true;
    });

    res.json({
      posts: filteredPosts.map((post) => formatPost(post, req.user.id)),
    });
  })
);

router.post(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const { content, image } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Post content is required" });
    }

    if (image && image.length > 10_000_000) {
      return res
        .status(400)
        .json({ error: "Image payload too large. Please upload a smaller file." });
    }

    const post = await Post.create({
      author: req.user.id,
      content: content.trim(),
      image: image || null,
    });

    await post.populate("author", "name email profile_photo");

    res.status(201).json({
      post: formatPost(post, req.user.id),
    });
  })
);

router.post(
  "/:postId/like",
  authenticate,
  asyncHandler(async (req, res) => {
    const post = await loadPost(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    post.likes = post.likes || [];
    const alreadyLiked = post.likes.some(
      (id) => id.toString() === req.user.id
    );

    if (alreadyLiked) {
      post.likes = post.likes.filter(
        (id) => id.toString() !== req.user.id
      );
    } else {
      post.likes.push(req.user.id);
    }

    await post.save();

    res.json({ post: formatPost(post, req.user.id) });
  })
);

router.post(
  "/:postId/comment",
  authenticate,
  asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment cannot be empty" });
    }

    const post = await loadPost(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    post.comments.push({
      user: req.user.id,
      text: text.trim(),
    });

    await post.save();
    await post.populate("comments.user", "name email profile_photo");

    res.json({ post: formatPost(post, req.user.id) });
  })
);

router.post(
  "/:postId/share",
  authenticate,
  asyncHandler(async (req, res) => {
    console.log("Share request received:", {
      params: req.params,
      body: req.body,
      user: req.user.id
    });
    const post = await loadPost(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const { conversationId, targetUserId } = req.body || {};

    let conversation;

    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await populateConversation(
        Conversation.findById(conversationId)
      );

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      ensureParticipant(conversation, req.user.id);
    }
    
    else if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
      const participantIds = [
        new mongoose.Types.ObjectId(req.user.id),
        new mongoose.Types.ObjectId(targetUserId)
      ];

      conversation = await Conversation.findOne({
        isGroup: false,
        participants: { $all: participantIds },
        $expr: { $eq: [{ $size: "$participants" }, 2] },
      });

      if (!conversation) {
        const newConv = await Conversation.create({
          isGroup: false,
          participants: participantIds,
        });
        
        conversation = await populateConversation(
          Conversation.findById(newConv._id)
        );
      } else {
        
        conversation = await populateConversation(
          Conversation.findById(conversation._id)
        );
      }
    }
    else {
      return res.status(400).json({
        error: "Either conversationId or targetUserId is required"
      });
    }

    const createdMessage = await Message.create({
      conversation: conversation._id,
      sender: req.user.id,
      text: "",
      post: post._id,
    });

    const messageDoc = await populateMessage(Message.findById(createdMessage._id));

    conversation = await updateConversationLastMessage(
      conversation,
      messageDoc
    );

    const sharedSet = new Set(
      (post.sharedWith || []).map((id) => id.toString())
    );
    conversation.participants.forEach((participant) => {
      sharedSet.add(participant._id.toString());
    });
    post.sharedWith = Array.from(sharedSet);
    post.sharesCount = post.sharedWith.length;
    await post.save();

    const io = req.app.get("io");
    emitMessageEvent(io, conversation, messageDoc);

    res.json({
      post: formatPost(post, req.user.id),
      conversationId: conversation._id.toString(),
    });
  })
);

router.delete(
  "/:postId",
  authenticate,
  asyncHandler(async (req, res) => {
    const post = await loadPost(req.params.postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.author._id.toString() !== req.user.id) {
      return res.status(403).json({ error: "You can only delete your own posts" });
    }

    await Post.findByIdAndDelete(req.params.postId);

    res.json({ message: "Post deleted successfully" });
  })
);

export default router;
