import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AppTheme } from "../context/DisplaySettingsContext";
import { useAppTheme } from "../hooks/useTheme";
import { searchMentionTargets, type MentionTarget } from "../services/mentionService";

type TextSelection = {
  start: number;
  end: number;
};

interface MentionTextInputProps extends Omit<TextInputProps, "onChangeText" | "style" | "value"> {
  value: string;
  onChangeText: (value: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

function getMentionQuery(value: string, cursorPosition: number): { query: string; start: number; end: number } | null {
  const beforeCursor = value.slice(0, cursorPosition);
  const match = beforeCursor.match(/@([a-zA-Z0-9_]*)$/);

  if (!match || match.index === undefined) {
    return null;
  }

  return {
    query: match[1] ?? "",
    start: match.index,
    end: cursorPosition,
  };
}

export function MentionTextInput({
  value,
  onChangeText,
  containerStyle,
  inputStyle,
  onBlur,
  onFocus,
  onKeyPress,
  onSelectionChange,
  editable = true,
  ...textInputProps
}: MentionTextInputProps) {
  const appTheme = useAppTheme();
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const [selection, setSelection] = useState<TextSelection>({ start: value.length, end: value.length });
  const [suggestions, setSuggestions] = useState<MentionTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionQuery = getMentionQuery(value, selection.start);
  const showDropdown = focused && editable && (loading || suggestions.length > 0) && Boolean(mentionQuery?.query);

  useEffect(() => {
    if (!focused || !editable || !mentionQuery || mentionQuery.query.length < 1) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const timeoutId = setTimeout(() => {
      searchMentionTargets(mentionQuery.query, 8)
        .then((results) => {
          if (active) {
            setSuggestions(results);
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }, 180);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [editable, focused, mentionQuery?.query]);

  const insertMention = (target: MentionTarget) => {
    const currentMention = getMentionQuery(value, selection.start);

    if (!currentMention) {
      return;
    }

    const insertedText = `@${target.username} `;
    const nextValue = `${value.slice(0, currentMention.start)}${insertedText}${value.slice(currentMention.end)}`;
    const nextCursor = currentMention.start + insertedText.length;

    onChangeText(nextValue);
    setSelection({ start: nextCursor, end: nextCursor });
    setSuggestions([]);
    setLoading(false);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        {...textInputProps}
        value={value}
        onChangeText={onChangeText}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          hideTimeoutRef.current = setTimeout(() => {
            setFocused(false);
            setSuggestions([]);
          }, 150);
          onBlur?.(event);
        }}
        onKeyPress={(event) => {
          if (event.nativeEvent.key === "Escape") {
            setSuggestions([]);
            setFocused(false);
          }

          onKeyPress?.(event);
        }}
        onSelectionChange={(event) => {
          setSelection(event.nativeEvent.selection);
          onSelectionChange?.(event);
        }}
        style={inputStyle}
        editable={editable}
      />
      {showDropdown ? (
        <View style={styles.dropdown}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={appTheme.colors.primary} />
            </View>
          ) : null}
          {!loading && suggestions.length > 0 ? (
            <FlatList
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              data={suggestions}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionRow}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                  accessibilityLabel={`Mention ${item.displayName}`}
                  onPress={() => {
                    if (hideTimeoutRef.current) {
                      clearTimeout(hideTimeoutRef.current);
                    }

                    insertMention(item);
                  }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.displayName.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.suggestionTextWrap}>
                    <View style={styles.nameRow}>
                      <Text style={styles.displayName} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                      {item.verified ? <Ionicons name="checkmark-circle" size={13} color={appTheme.colors.success} /> : null}
                    </View>
                    <Text style={styles.username} numberOfLines={1}>
                      @{item.username}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      position: "relative",
      zIndex: 5,
    },
    dropdown: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.lightBorder,
      borderRadius: theme.radius.sm,
      borderWidth: theme.borderWidth,
      maxHeight: 220,
      overflow: "hidden",
    },
    loadingRow: {
      alignItems: "center",
      minHeight: 44,
      justifyContent: "center",
    },
    suggestionRow: {
      alignItems: "center",
      borderTopColor: theme.colors.lightBorder,
      borderTopWidth: theme.borderWidth,
      flexDirection: "row",
      gap: theme.spacing.sm,
      minHeight: 44,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
    },
    avatar: {
      alignItems: "center",
      backgroundColor: theme.colors.phaseBg,
      borderRadius: 16,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    avatarText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "500",
    },
    suggestionTextWrap: {
      flex: 1,
    },
    nameRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 5,
    },
    displayName: {
      color: theme.colors.text,
      flexShrink: 1,
      fontSize: 13,
      fontWeight: "500",
    },
    username: {
      color: theme.colors.subtext,
      fontSize: 12,
      marginTop: 1,
    },
  });
}
