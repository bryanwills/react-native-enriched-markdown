import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EnrichedMarkdownTextInput,
  type EnrichedMarkdownTextInputInstance,
  type StyleState,
  type CaretRect,
} from 'react-native-enriched-markdown';
import { FormattingToolbar } from '../../components/FormattingToolbar';
import { MessageBubble } from './MessageBubble';
import type { RootStackScreenProps } from '../../navigation/types';
import type { BubbleContextMenuItem, MentionItem, MessageItem } from './types';
import {
  MY_NICK,
  USER_MENTIONS,
  CHANNEL_MENTIONS,
  CHANNEL_DATA,
  buildMessages,
} from './channelData';
import { MARKDOWN_STYLE } from './markdownStyle';

// ─── UnreadDivider ────────────────────────────────────────────────────────────

function UnreadDivider({ count }: { count: number }) {
  return (
    <View style={dividerStyles.row}>
      <View style={dividerStyles.line} />
      <Text style={dividerStyles.label}>{count} new messages</Text>
      <View style={dividerStyles.line} />
    </View>
  );
}

const UNREAD_RED = '#F23F42';

const dividerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: UNREAD_RED,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: UNREAD_RED,
  },
});

// ─── MentionSuggestionPopup ───────────────────────────────────────────────────

function MentionSuggestionPopup({
  indicator,
  data,
  top,
  onItemPress,
}: {
  indicator: string | null;
  data: MentionItem[];
  top: number;
  onItemPress: (item: MentionItem) => void;
}) {
  if (indicator == null || data.length === 0) return null;

  const isUserMention = indicator === '@';
  const renderItem = ({ item }: ListRenderItemInfo<MentionItem>) => (
    <Pressable
      style={({ pressed }) => [
        styles.mentionItem,
        pressed && styles.mentionItemPressed,
      ]}
      onPress={() => onItemPress(item)}
    >
      <View style={styles.mentionAvatar}>
        <Text style={styles.mentionAvatarText}>
          {isUserMention ? '@' : '#'}
        </Text>
      </View>
      <Text style={styles.mentionName}>{item.name}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.mentionPopup, { top }]}>
      <FlatList
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
        data={data}
        keyExtractor={(item) => item.url}
        renderItem={renderItem}
        style={styles.mentionList}
      />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type Props = RootStackScreenProps<'Input'>;

export default function InputScreen({ navigation, route }: Props) {
  const channel = route.params.channel;

  const inputRef = useRef<EnrichedMarkdownTextInputInstance>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const nextIdRef = useRef((CHANNEL_DATA[channel]?.messages.length ?? 0) + 2);
  const [state, setState] = useState<StyleState | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>(() =>
    buildMessages(channel)
  );
  const [hasSelection, setHasSelection] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [activeMention, setActiveMention] = useState<{
    indicator: string;
    text: string;
  } | null>(null);
  const [caretRect, setCaretRect] = useState<CaretRect | null>(null);
  const [inputRowY, setInputRowY] = useState(0);
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => {
      setKeyboardVisible(true);
      scrollRef.current?.scrollToEnd({ animated: false });
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const mentionSuggestions = useMemo(() => {
    if (activeMention == null) return [];

    const source =
      activeMention.indicator === '@' ? USER_MENTIONS : CHANNEL_MENTIONS;
    const query = activeMention.text.toLowerCase();

    return source.filter((item) => item.name.toLowerCase().startsWith(query));
  }, [activeMention]);

  const sendMessage = useCallback(async () => {
    const md = await inputRef.current?.getMarkdown();
    if (!md || md.trim().length === 0) return;

    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    setMessages((prev) => [
      ...prev,
      {
        id: nextIdRef.current++,
        kind: 'message',
        nick: MY_NICK,
        message: md.trim(),
        time,
      },
    ]);

    inputRef.current?.setValue('');
    setActiveMention(null);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  const handleMentionSelected = useCallback((item: MentionItem) => {
    const indicator = item.url.startsWith('user://') ? '@' : '#';
    inputRef.current?.insertMention(`${indicator}${item.name}`, item.url);
    setActiveMention(null);
  }, []);

  const handleBubbleLinkPress = useCallback(
    ({ url }: { url: string }) => {
      if (url.startsWith('channel://')) {
        const target = url.slice('channel://'.length);
        navigation.push('Input', { channel: target });
      }
    },
    [navigation]
  );

  const bubbleContextMenuItems = useMemo<BubbleContextMenuItem[]>(
    () => [
      {
        text: 'Summarize with AI',
        icon: Platform.OS === 'ios' ? 'sparkles' : undefined,
        onPress: ({ text }) => {
          Alert.alert('✦ Summarize with AI', `"${text}"`, [
            { text: 'Dismiss', style: 'cancel' },
          ]);
        },
      },
      {
        text: 'Reply',
        icon:
          Platform.OS === 'ios' ? 'arrowshape.turn.up.left.fill' : undefined,
        onPress: ({ text }) => {
          inputRef.current?.setValue(`> ${text}\n\n`);
          inputRef.current?.focus();
        },
      },
    ],
    []
  );

  const inputContextMenuItems = useMemo(
    () => [
      {
        text: '✦ Summarize with AI',
        icon: Platform.OS === 'ios' ? 'sparkles' : undefined,
        onPress: ({
          text,
          styleState,
        }: {
          text: string;
          styleState: StyleState;
        }) => {
          const flags = [
            styleState.bold.isActive && 'bold',
            styleState.italic.isActive && 'italic',
            styleState.underline.isActive && 'underline',
            styleState.strikethrough.isActive && 'strikethrough',
            styleState.spoiler.isActive && 'spoiler',
            styleState.link.isActive && 'link',
          ]
            .filter(Boolean)
            .join(', ');
          Alert.alert(
            '✦ Summarize with AI',
            `"${text}"${flags ? `\n\nActive styles: ${flags}` : ''}`,
            [{ text: 'Dismiss', style: 'cancel' }]
          );
        },
      },
    ],
    []
  );

  const inputRowPaddingStyle = useMemo(
    () => ({ paddingBottom: keyboardVisible ? 16 : 16 + bottomInset }),
    [keyboardVisible, bottomInset]
  );

  return (
    <View style={styles.container} testID="input-screen">
      <View style={[styles.header, { paddingTop: topInset + 4 }]}>
        {navigation.canGoBack() && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>#</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>#{channel}</Text>
          <Text style={styles.headerStatus}>4 members</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior="position"
        enabled
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
        >
          {messages.map((item) =>
            item.kind === 'divider' ? (
              <UnreadDivider key={item.id} count={item.count} />
            ) : (
              <MessageBubble
                key={item.id}
                nick={item.nick}
                time={item.time}
                message={item.message}
                isMe={item.nick === MY_NICK}
                contextMenuItems={bubbleContextMenuItems}
                onLinkPress={handleBubbleLinkPress}
              />
            )
          )}
        </ScrollView>

        <FormattingToolbar
          state={state}
          inputRef={inputRef}
          hasSelection={hasSelection}
          mentionIndicators={['@', '#']}
        />

        <View
          style={[styles.inputRow, inputRowPaddingStyle]}
          onLayout={(e) => setInputRowY(e.nativeEvent.layout.y)}
        >
          <EnrichedMarkdownTextInput
            ref={inputRef}
            placeholder={`Message #${channel}...`}
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            markdownStyle={MARKDOWN_STYLE}
            mentionIndicators={['@', '#']}
            onChangeState={setState}
            onCaretRectChange={setCaretRect}
            onChangeSelection={(sel) => setHasSelection(sel.start !== sel.end)}
            onStartMention={({ indicator }) => {
              setActiveMention({ indicator, text: '' });
            }}
            onChangeMention={({ indicator, text }) => {
              setActiveMention({ indicator, text });
            }}
            onEndMention={() => {
              setActiveMention(null);
            }}
            contextMenuItems={inputContextMenuItems}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendIcon}>▶</Text>
          </TouchableOpacity>
        </View>
        <MentionSuggestionPopup
          indicator={activeMention?.indicator ?? null}
          data={mentionSuggestions}
          top={Math.max(0, inputRowY + (caretRect?.y ?? 0) - 172)}
          onItemPress={handleMentionSelected}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const MAIN_COLOR = '#BEEBD0';
const MAIN_TEXT = '#001A72';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F4F8',
  },
  flex: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingBottom: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: MAIN_COLOR,
    zIndex: 2,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    color: MAIN_TEXT,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '300',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: MAIN_TEXT,
    fontWeight: '700',
    fontSize: 14,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    color: MAIN_TEXT,
    fontWeight: '700',
    fontSize: 16,
  },
  headerStatus: {
    color: 'rgba(0, 26, 114, 0.7)',
    fontSize: 12,
  },
  messageListContent: {
    paddingTop: 80,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  mentionPopup: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
    zIndex: 10,
  },
  mentionList: {
    maxHeight: 164,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mentionItemPressed: {
    backgroundColor: '#EEF2FF',
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mentionAvatarText: {
    color: '#4B5563',
    fontWeight: '700',
    fontSize: 16,
  },
  mentionName: {
    color: '#111827',
    fontSize: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 12,
    backgroundColor: '#F9FAFB',
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MAIN_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    color: MAIN_TEXT,
    fontSize: 14,
    marginLeft: 2,
  },
});
