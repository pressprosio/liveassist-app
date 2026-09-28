/**
 * Renders the light formatting the assistant uses (**bold**, `code`, [links](https://…),
 * bare URLs, "- " lists) as native text. Nothing is interpreted as HTML.
 */
import { Linking, StyleSheet, Text, View, type TextStyle } from 'react-native';

const TOKEN = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g;

function Inline({ text, color }: { text: string; color: string }) {
  const parts = text.split(TOKEN).filter((p) => p !== '');
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) return <Text key={i} style={{ fontWeight: '700' }}>{p.slice(2, -2)}</Text>;
        if (p.startsWith('`') && p.endsWith('`')) return <Text key={i} style={styles.code}>{p.slice(1, -1)}</Text>;
        const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(p);
        if (link) return <Text key={i} style={[styles.link, { color }]} onPress={() => Linking.openURL(link[2]!)}>{link[1]}</Text>;
        if (/^https?:\/\//.test(p)) return <Text key={i} style={[styles.link, { color }]} onPress={() => Linking.openURL(p)}>{p}</Text>;
        return <Text key={i}>{p}</Text>;
      })}
    </>
  );
}

export function FormattedText({ text, style }: { text: string; style?: TextStyle }) {
  const color = (style?.color as string) || '#17202C';
  const blocks = text.split(/\n{2,}/);
  return (
    <View style={{ gap: 6 }}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l));
        if (isList) {
          return (
            <View key={bi} style={{ gap: 2 }}>
              {lines.map((l, li) => {
                const numbered = /^\s*(\d+)\./.exec(l);
                return (
                  <View key={li} style={styles.listRow}>
                    <Text style={[style, styles.bullet]}>{numbered ? `${numbered[1]}.` : '•'}</Text>
                    <Text style={[style, { flex: 1 }]}><Inline text={l.replace(/^\s*([-*]|\d+\.)\s+/, '')} color={color} /></Text>
                  </View>
                );
              })}
            </View>
          );
        }
        return <Text key={bi} style={style}><Inline text={block} color={color} /></Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  code: { fontFamily: 'Courier', backgroundColor: 'rgba(0,0,0,0.07)' },
  link: { textDecorationLine: 'underline' },
  listRow: { flexDirection: 'row', gap: 6 },
  bullet: { minWidth: 14 },
});
