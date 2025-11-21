import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Post from "../models/Post.js";
import {
  formatConversation,
  formatMessage,
  populateConversation,
  populateMessage,
  ensureParticipant,
  updateConversationLastMessage,
  emitMessageEvent,
  normalizeParticipantIds,
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
    console.error("❌ Chat auth failed:", error?.message || error);
    return res.status(403).json({ error: "Invalid token" });
  }
};

router.get(
  "/conversations",
  authenticate,
  async (req, res) => {
    const conversations = await populateConversation(
      Conversation.find({
        participants: req.user.id,
      }).sort({ lastMessageAt: -1, updatedAt: -1 })
    );

    res.json({
      conversations: conversations.map((conversation) =>
        formatConversation(conversation, req.user.id)
      ),
    });
  }
);

router.post(
  "/conversations",
  authenticate,
  async (req, res) => {
    const { participantIds = [], name } = req.body || {};
    const participantObjectIds = normalizeParticipantIds(
      participantIds,
      req.user.id
    );

    if (participantObjectIds.length < 2) {
      return res.status(400).json({
        error: "Conversation must include at least one other participant",
      });
    }

    let conversation;

    if (participantObjectIds.length === 2 && !name) {
      conversation = await Conversation.findOne({
        isGroup: false,
        participants: { $all: participantObjectIds },
        $expr: { $eq: [{ $size: "$participants" }, 2] },
      });
    }

    if (!conversation) {
      conversation = await Conversation.create({
        name: name?.trim() || null,
        isGroup: participantObjectIds.length > 2 || Boolean(name),
        participants: participantObjectIds,
      });
    }

    await populateConversation(conversation);

    res.status(201).json({
      conversation: formatConversation(conversation, req.user.id),
    });
  }
);

router.get(
  "/conversations/:conversationId/messages",
  authenticate,
  async (req, res) => {
    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation id" });
    }

    const conversation = await populateConversation(
      Conversation.findById(conversationId)
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    ensureParticipant(conversation, req.user.id);

    const limit = parseInt(req.query.limit, 10) || 50;
    const messages = await populateMessage(
      Message.find({ conversation: conversationId })
        .sort({ createdAt: -1 })
        .limit(limit)
    );

    res.json({
      messages: messages
        .reverse()
        .map((message) => formatMessage(message)),
    });
  }
);

router.post(
  "/conversations/:conversationId/messages",
  authenticate,
  async (req, res) => {
    const { conversationId } = req.params;
    const { text, postId } = req.body || {};

    if (!text?.trim() && !postId) {
      return res.status(400).json({
        error: "Message text or post share is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation id" });
    }

    const conversation = await populateConversation(
      Conversation.findById(conversationId)
    );

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    ensureParticipant(conversation, req.user.id);

    let post = null;

    if (postId) {
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        return res.status(400).json({ error: "Invalid post id" });
      }
      post = await Post.findById(postId).populate(
        "author",
        "name email profile_photo"
      );
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
    }

    const message = await populateMessage(
      Message.create({
        conversation: conversationId,
        sender: req.user.id,
        text: text?.trim() || "",
        post: post ? post._id : undefined,
      })
    );

    await updateConversationLastMessage(conversation, message);

    if (post) {
      const sharedSet = new Set(
        (post.sharedWith || []).map((id) => id.toString())
      );
      conversation.participants.forEach((participant) => {
        sharedSet.add(participant._id.toString());
      });
      post.sharedWith = Array.from(sharedSet);
      post.sharesCount = post.sharedWith.length;
      await post.save();
    }

    const io = req.app.get("io");
    if (io) {
      emitMessageEvent(io, conversation, message);
    }

    res.status(201).json({
      message: formatMessage(message),
      conversation: formatConversation(conversation, req.user.id),
    });
  }
);

export default router;

