import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { StateBadge } from '@/components/StateBadge';
import { ago, plain } from '@/components/time';
import { useSession } from '@/lib/session';
import { colors, space, topicLabel } from '@/lib/theme';
import type { ConversationSummary } from '@/lib/types';

type Filter = 'open' | 'waiting' | 'closed';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'waiting', label: 'Needs a person' },
  { key: 'closed', label: 'Recently closed' },
];

export default function Inbox() {
  const { conversations, refresh, session } = useSession();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('open');
  const [refreshing, setRefreshing] = useState(false);

  const list = useMemo(() => {
    return Object.values(conversations)
      .filter((c) => (filter === 'waiting' ? c.state === 'waiting_human' : filter === 'closed' ? c.state === 'closed' : c.state !== 'closed'))
      .sort((a, b) => {
        const wa = a.state === 'waiting_human', wb = b.state === 'waiting_human';
        if (wa !== wb) return wa ? -1 : 1;
        return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
      });
  }, [conversations, filter]);

  const waiting = useMemo(() => Object.values(conversations).filter((c) => c.state === 'waiting_human').length, [conversations]);

  function choose(f: Filter) {
    setFilter(f);
    if (f === 'closed') refresh(true);
  }

  function onRefresh() {
    setRefreshing(true);
    refresh(filter === 'closed');
    setTimeout(() => setRefreshing(false), 700);
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Chats',
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} hitSlop={12}>
              <Text style={styles.headerLink}>Settings</Text>
            </Pressable>
          ),
        }}
      />
      <ConnectionBanner />
      <View style={styles.filters} accessibilityRole="tablist">
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable key={f.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => choose(f.key)}
              style={[styles.pill, on && styles.pillOn]}>
              <Text style={[styles.pillText, on && styles.pillTextOn]}>
                {f.label}{f.key === 'waiting' && waiting ? ` (${waiting})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <Row c={item} mine={item.agent_id === session?.agent.id} onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: item.id } })} />}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filter === 'waiting' ? 'Nobody is waiting for a person.' : filter === 'closed' ? 'No chats ended in the last 7 days.' : 'No open chats. New ones appear here as visitors write.'}
          </Text>
        }
        contentContainerStyle={list.length ? undefined : { flexGrow: 1 }}
      />
    </View>
  );
}

function Row({ c, mine, onPress }: { c: ConversationSummary; mine: boolean; onPress: () => void }) {
  const prefix = c.last_role === 'agent' ? 'Team: ' : c.last_role === 'ai' ? 'AI: ' : '';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.wash }]}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>{c.name || c.email || 'Visitor'}</Text>
        <Text style={styles.time}>{ago(c.last_activity_at)}</Text>
      </View>
      <View style={styles.rowMeta}>
        <StateBadge state={c.state} suffix={c.state === 'human_active' ? (mine ? 'you' : c.agent_name || undefined) : undefined} />
        <Text style={styles.site} numberOfLines={1}>{c.site_name} · {topicLabel[c.topic] || c.topic}</Text>
      </View>
      {c.last_text ? <Text style={styles.last} numberOfLines={2}>{prefix}{plain(c.last_text)}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerLink: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  filters: { flexDirection: 'row', gap: space.sm, padding: space.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  pillTextOn: { color: '#fff' },
  row: { backgroundColor: colors.surface, paddingHorizontal: space.lg, paddingVertical: 14, gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
  time: { fontSize: 13, color: colors.muted },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  site: { flex: 1, fontSize: 13, color: colors.muted },
  last: { fontSize: 15, color: colors.muted, lineHeight: 20 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  empty: { color: colors.muted, textAlign: 'center', padding: 40, fontSize: 15, lineHeight: 21 },
});
