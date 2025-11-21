import mongoose from "mongoose";

export const formatUser = (userDoc) =>
  userDoc
    ? {
        id: userDoc._id.toString(),
        name: userDoc.name,
        email: userDoc.email,
        profile_photo: userDoc.profile_photo || null,
      }
    : null;

export const formatPostSummary = (postDoc) => {
  if (!postDoc) return null;
  const contentPreview = (postDoc.content || "").slice(0, 200);
  return {
    id: postDoc._id.toString(),
    content: contentPreview,
    image: postDoc.image || null,
    author: postDoc.author ? formatUser(postDoc.author) : null,
  };
};

export const formatMessage = (messageDoc) => ({
  id: messageDoc._id.toString(),
  text: messageDoc.text,
  createdAt: messageDoc.createdAt,
  sender: formatUser(messageDoc.sender),
  post: formatPostSummary(messageDoc.post),
});

const resolveConversationName = (conversation, currentUserId) => {
  if (conversation.isGroup) {
    return conversation.name || "Group chat";
  }
  const other = conversation.participants.find(
    (participant) => participant._id.toString() !== currentUserId
  );
  return other ? other.name : "Conversation";
};

export const formatConversation = (conversation, currentUserId) => ({
  id: conversation._id.toString(),
  name: resolveConversationName(conversation, currentUserId),
  isGroup: conversation.isGroup,
  participants: conversation.participants.map(formatUser),
  lastMessage: conversation.lastMessage
    ? formatMessage(conversation.lastMessage)
    : null,
  lastMessageAt: conversation.lastMessageAt,
});

export const populateMessage = (query) =>
  query
    .populate("sender", "name email profile_photo")
    .populate({
      path: "post",
      populate: { path: "author", select: "name email profile_photo" },
      select: "content image author",
    });

export const populateConversation = (query) =>
  query
    .populate("participants", "name email profile_photo")
    .populate({
      path: "lastMessage",
      populate: [
        { path: "sender", select: "name email profile_photo" },
        {
          path: "post",
          populate: { path: "author", select: "name email profile_photo" },
          select: "content image author",
        },
      ],
    });

export const ensureParticipant = (conversation, userId) => {
  const isParticipant = conversation.participants.some(
    (participant) => participant._id.toString() === userId
  );
  if (!isParticipant) {
    const error = new Error("Not a conversation participant");
    error.status = 403;
    throw error;
  }
};

export const updateConversationLastMessage = async (conversation, message) => {
  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();
  await conversation.populate([
    { path: "participants", select: "name email profile_photo" },
    {
      path: "lastMessage",
      populate: [
        { path: "sender", select: "name email profile_photo" },
        {
          path: "post",
          populate: { path: "author", select: "name email profile_photo" },
          select: "content image author",
        },
      ],
    },
  ]);
  return conversation;
};

export const emitMessageEvent = (io, conversation, message) => {
  if (!io) return;
  const payload = {
    conversationId: conversation._id.toString(),
    message: formatMessage(message),
  };

  io.to(`conversation:${conversation._id.toString()}`).emit(
    "message:new",
    payload
  );

  conversation.participants.forEach((participant) => {
    io.to(`user:${participant._id.toString()}`).emit(
      "conversation:update",
      {
        conversation: formatConversation(
          conversation,
          participant._id.toString()
        ),
      }
    );
  });
};

export const normalizeParticipantIds = (participantIds = [], currentUserId) => {
  const uniqueParticipantIds = new Set(
    participantIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
  );
  uniqueParticipantIds.add(currentUserId);
  return Array.from(uniqueParticipantIds).map(
    (id) => new mongoose.Types.ObjectId(id)
  );
};

