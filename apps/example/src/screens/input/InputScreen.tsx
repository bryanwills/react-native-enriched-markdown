import { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  EnrichedMarkdownTextInput,
  type EnrichedMarkdownTextInputInstance,
  type StyleState,
  type LinkPressEvent,
} from 'react-native-enriched-markdown';
import { FormattingToolbar } from '../../components/FormattingToolbar';
import { MessageBubble, type BubbleContextMenuItem } from './MessageBubble';
import type { RootStackScreenProps } from '../../navigation/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type RawMessage = {
  nick: string;
  time: string;
  message: string;
};

type ChannelData = {
  messages: RawMessage[];
  newFromIndex: number;
};

type MessageItem =
  | { id: number; kind: 'message'; nick: string; time: string; message: string }
  | { id: number; kind: 'divider'; count: number };

// ─── Data ─────────────────────────────────────────────────────────────────────

const MY_NICK = 'me';

const CHANNEL_DATA: Record<string, ChannelData> = {
  'random': {
    newFromIndex: 13,
    messages: [
      { nick: 'alice', time: '12:05', message: 'morning everyone!' },
      { nick: 'dave', time: '12:06', message: 'morning ☀️' },
      {
        nick: 'carol',
        time: '12:07',
        message: 'hey! running a bit late today',
      },
      {
        nick: 'bob',
        time: '12:10',
        message: '## Heads up\n\ndeployment scheduled for 3pm today',
      },
      { nick: 'alice', time: '12:11', message: "@bob noted, we'll be ready" },
      {
        nick: 'dave',
        time: '12:15',
        message: 'run `git pull origin main` before starting',
      },
      {
        nick: 'carol',
        time: '12:16',
        message:
          '> deployment scheduled for 3pm today\n\ndoes this affect staging too?',
      },
      { nick: 'bob', time: '12:17', message: 'yes, staging first then prod' },
      {
        nick: 'alice',
        time: '12:45',
        message: '||the prod deploy passphrase is hunter2||',
      },
      { nick: 'dave', time: '12:46', message: '@alice 😂 please no' },
      { nick: 'carol', time: '13:02', message: 'anyone up for a quick sync?' },
      { nick: 'bob', time: '13:05', message: 'sure, 10 mins?' },
      { nick: 'alice', time: '13:06', message: 'works for me 👍' },
      // ── new messages below ──
      { nick: 'alice', time: '14:15', message: 'anything new today?' },
      { nick: 'dave', time: '14:16', message: 'not really, pretty quiet' },
      {
        nick: 'bob',
        time: '14:22',
        message: '### Announcement\n\n|| I love bananas ||',
      },
      {
        nick: 'carol',
        time: '14:22',
        message: '@bob you truly are a silly guy 😂',
      },
      { nick: 'dave', time: '14:23', message: 'wait what 💀' },
      { nick: 'alice', time: '14:23', message: 'I stand by this' },
      {
        nick: 'carol',
        time: '14:24',
        message:
          'someone post this in [#team-lunch](channel://team-lunch) lmao',
      },
    ],
  },
  'team-lunch': {
    newFromIndex: 9,
    messages: [
      {
        nick: 'alice',
        time: '10:00',
        message: '## Lunch Plans\n\nanyone have suggestions for today?',
      },
      {
        nick: 'dave',
        time: '10:02',
        message: 'what about the new place on 5th?',
      },
      {
        nick: 'carol',
        time: '10:05',
        message: 'checked their menu — `avg $15` per person, looks solid',
      },
      { nick: 'bob', time: '10:08', message: "sounds good, I'm in" },
      {
        nick: 'alice',
        time: '10:10',
        message:
          "> sounds good, I'm in\n\n@bob finally a quick answer from you 😄",
      },
      {
        nick: 'dave',
        time: '10:12',
        message: "||I'm secretly getting the triple burger||",
      },
      { nick: 'carol', time: '10:13', message: '@dave I saw that 👀' },
      { nick: 'bob', time: '10:15', message: 'meeting at lobby, 12:30?' },
      { nick: 'alice', time: '10:16', message: '👍 see you there' },
      // ── new messages below ──
      { nick: 'carol', time: '12:45', message: 'that was SO good' },
      { nick: 'dave', time: '12:46', message: 'the fries though 🍟' },
      {
        nick: 'alice',
        time: '12:47',
        message: '## Verdict\n\n|| 10/10 would go back ||',
      },
      {
        nick: 'bob',
        time: '12:50',
        message: "@carol @dave @alice we're making this a weekly thing",
      },
    ],
  },
};

const MARKDOWN_STYLE = {
  link: { color: '#2563EB', underline: true },
};

function buildMessages(channel: string): MessageItem[] {
  const data = CHANNEL_DATA[channel];
  if (!data) return [];

  const { messages, newFromIndex } = data;
  const newCount = messages.length - newFromIndex;
  const result: MessageItem[] = [];
  let id = 1;

  messages.forEach((msg, i) => {
    if (i === newFromIndex && newCount > 0) {
      result.push({ id: id++, kind: 'divider', count: newCount });
    }
    result.push({ id: id++, kind: 'message', ...msg });
  });

  return result;
}

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
  const [headerHeight, setHeaderHeight] = useState(0);
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

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
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  const handleLinkPress = useCallback(
    (event: LinkPressEvent) => {
      const { url } = event;
      if (url.startsWith('channel://')) {
        navigation.push('Input', { channel: url.slice('channel://'.length) });
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

  return (
    <View style={styles.container} testID="input-screen">
      <View
        style={[styles.header, { paddingTop: topInset + 4 }]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
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
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
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
                onLinkPress={handleLinkPress}
              />
            )
          )}
        </ScrollView>

        <FormattingToolbar
          state={state}
          inputRef={inputRef}
          hasSelection={hasSelection}
        />

        <View style={[styles.inputRow, { paddingBottom: 12 + bottomInset }]}>
          <EnrichedMarkdownTextInput
            ref={inputRef}
            placeholder={`Message #${channel}...`}
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            markdownStyle={MARKDOWN_STYLE}
            onChangeState={setState}
            onChangeSelection={(sel) => setHasSelection(sel.start !== sel.end)}
            contextMenuItems={inputContextMenuItems}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendIcon}>▶</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const TEAL = '#4A9EBF';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F4F8',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: TEAL,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    color: '#fff',
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
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerStatus: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
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
    backgroundColor: TEAL,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 2,
  },
});
