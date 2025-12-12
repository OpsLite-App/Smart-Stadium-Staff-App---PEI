import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface } from 'react-native-paper';
import { theme } from '../theme';
import { useChatStore, Message } from '../stores/useChatStore';
import { useAuthStore } from '../stores/useAuthStore';

export default function ChatScreen() {
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  
  const { user } = useAuthStore();
  const {
    messages,
    groups,
    activeGroupId,
    onlineUsers,
    sendMessage,
    setActiveGroup,
  } = useChatStore();

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const groupMessages = messages.filter(msg => msg.groupId === activeGroupId);
  const isOnline = (userId: string) => onlineUsers.includes(userId);

  useEffect(() => {
    if (flatListRef.current && groupMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [groupMessages.length]);

  const handleSend = () => {
    if (inputText.trim() && activeGroupId) {
      sendMessage(inputText.trim(), activeGroupId);
      setInputText('');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === 'current-user';
    const isSystem = item.senderId === 'system';
    
    return (
      <View style={[
        styles.messageContainer,
        isMe && styles.myMessageContainer,
        isSystem && styles.systemMessageContainer
      ]}>
        {!isMe && !isSystem && (
          <View style={styles.senderInfo}>
            <MaterialCommunityIcons
              name={getRoleIcon(item.senderRole)}
              size={16}
              color={getRoleColor(item.senderRole)}
            />
            <Text style={styles.senderName}>{item.senderName}</Text>
            <Text style={styles.senderRole}>{item.senderRole}</Text>
            {isOnline(item.senderId) && (
              <View style={styles.onlineDot} />
            )}
          </View>
        )}

        <Surface style={[
          styles.messageBubble,
          isMe && styles.myMessageBubble,
          isSystem && styles.systemMessageBubble
        ]} elevation={1}>
          <Text style={[
            styles.messageText,
            isMe && styles.myMessageText,
            isSystem && styles.systemMessageText
          ]}>
            {item.text}
          </Text>
        </Surface>

        <Text style={styles.timestamp}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    );
  };

  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'Security': return 'shield-account';
      case 'Cleaning': return 'broom';
      case 'Supervisor': return 'account-tie';
      default: return 'account';
    }
  };

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'Security': return '#3B82F6';
      case 'Cleaning': return '#10B981';
      case 'Supervisor': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-PT', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header com grupos */}
      <Surface style={styles.header} elevation={2}>
        <FlatList
          horizontal
          data={groups}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.groupTab,
                activeGroupId === item.id && styles.activeGroupTab,
                { borderColor: item.color }
              ]}
              onPress={() => setActiveGroup(item.id)}
            >
              <MaterialCommunityIcons
                name={item.icon as any}
                size={20}
                color={activeGroupId === item.id ? 'white' : item.color}
              />
              <Text style={[
                styles.groupName,
                activeGroupId === item.id && styles.activeGroupName
              ]}>
                {item.name}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </Surface>

      {/* Área de mensagens */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={groupMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="chat-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
              <Text style={styles.emptySubtext}>Seja o primeiro a falar!</Text>
            </View>
          }
        />

        {/* Input de mensagem */}
        <Surface style={styles.inputContainer} elevation={4}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={`Mensagem em ${activeGroup?.name}...`}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <MaterialCommunityIcons
              name="send"
              size={24}
              color={inputText.trim() ? 'white' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </Surface>
      </KeyboardAvoidingView>

      {/* Status bar */}
      <Surface style={styles.statusBar} elevation={1}>
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.statusText}>{onlineUsers.length} online</Text>
        </View>
        <View style={styles.statusItem}>
          <MaterialCommunityIcons name="wifi" size={16} color="#10B981" />
          <Text style={styles.statusText}>Conexão estável</Text>
        </View>
        <Text style={styles.groupInfo}>
          {activeGroup?.description}
        </Text>
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  groupTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'white',
  },
  activeGroupTab: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  groupName: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeGroupName: {
    color: 'white',
  },
  badge: {
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chatArea: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 80,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '85%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  systemMessageContainer: {
    alignSelf: 'center',
    maxWidth: '95%',
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  senderRole: {
    fontSize: 10,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    backgroundColor: 'white',
  },
  myMessageBubble: {
    backgroundColor: theme.colors.primary,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 4,
  },
  systemMessageBubble: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  messageText: {
    fontSize: 14,
    color: '#1F2937',
  },
  myMessageText: {
    color: 'white',
  },
  systemMessageText: {
    color: '#92400E',
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: '#1F2937',
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#6B7280',
  },
  groupInfo: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});