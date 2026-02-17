class ChatMessage {
  final String room;        // ex: "security", "cleaning", "supervisor"
  final String senderId;    // userId
  final String senderName;  // username
  final String text;
  final DateTime ts;

  ChatMessage({
    required this.room,
    required this.senderId,
    required this.senderName,
    required this.text,
    required this.ts,
  });

  Map<String, dynamic> toJson() => {
        "type": "chat",
        "room": room,
        "sender_id": senderId,
        "sender_name": senderName,
        "text": text,
        "ts": ts.toIso8601String(),
      };

  static ChatMessage? tryParse(Map<String, dynamic> m) {
    if (m["type"] != "chat") return null;
    final room = (m["room"] ?? "").toString();
    final text = (m["text"] ?? "").toString();
    if (room.isEmpty || text.isEmpty) return null;

    return ChatMessage(
      room: room,
      senderId: (m["sender_id"] ?? "").toString(),
      senderName: (m["sender_name"] ?? "").toString(),
      text: text,
      ts: DateTime.tryParse((m["ts"] ?? "").toString()) ?? DateTime.now(),
    );
  }
}
