import { useEffect, useMemo, useState } from "react";
import { StyleProp, Text, TextProps, TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { extractMentionUsernames, MENTION_PATTERN } from "../utils/mentions";
import { resolveMentionTargets, type MentionTarget } from "../services/mentionService";

const MENTION_LINK_COLOR = "#0D1B3E";

interface MentionTextProps extends Omit<TextProps, "children"> {
  text: string;
  style?: StyleProp<TextStyle>;
}

type TextPart =
  | {
      type: "text";
      value: string;
      key: string;
    }
  | {
      type: "mention";
      value: string;
      username: string;
      key: string;
    };

function splitMentionText(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const fullMatch = match[0] ?? "";
    const username = match[1]?.toLowerCase() ?? "";

    if (matchIndex > lastIndex) {
      parts.push({
        type: "text",
        value: text.slice(lastIndex, matchIndex),
        key: `text-${lastIndex}`,
      });
    }

    parts.push({
      type: "mention",
      value: fullMatch,
      username,
      key: `mention-${matchIndex}-${username}`,
    });
    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      value: text.slice(lastIndex),
      key: `text-${lastIndex}`,
    });
  }

  return parts.length > 0 ? parts : [{ type: "text", value: text, key: "text-0" }];
}

export function MentionText({ text, style, ...textProps }: MentionTextProps) {
  const router = useRouter();
  const parts = useMemo(() => splitMentionText(text), [text]);
  const usernames = useMemo(() => extractMentionUsernames(text), [text]);
  const [targetsByUsername, setTargetsByUsername] = useState<Map<string, MentionTarget>>(new Map());

  useEffect(() => {
    let mounted = true;

    if (usernames.length === 0) {
      setTargetsByUsername(new Map());
      return;
    }

    resolveMentionTargets(usernames).then((targets) => {
      if (mounted) {
        setTargetsByUsername(targets);
      }
    });

    return () => {
      mounted = false;
    };
  }, [usernames.join(",")]);

  const openMention = (target: MentionTarget) => {
    if (target.type === "organization") {
      router.push(`/organization/${target.username}`);
      return;
    }

    router.push(`/profile/${target.id}`);
  };

  return (
    <Text {...textProps} style={style}>
      {parts.map((part) => {
        if (part.type === "text") {
          return <Text key={part.key}>{part.value}</Text>;
        }

        const target = targetsByUsername.get(part.username);

        if (!target) {
          return <Text key={part.key}>{part.value}</Text>;
        }

        return (
          <Text
            key={part.key}
            accessibilityRole="link"
            onPress={() => openMention(target)}
            style={{ color: MENTION_LINK_COLOR, textDecorationLine: "underline" }}
          >
            {part.value}
          </Text>
        );
      })}
    </Text>
  );
}
