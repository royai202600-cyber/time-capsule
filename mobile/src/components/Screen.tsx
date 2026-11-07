import React, { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View, Pressable, type ScrollViewProps } from "react-native";
import { C, serif, sans } from "../theme";
import { ArtIcon } from './ArtIcon';
/** Shared native keyboard handling; web keeps the browser's normal focus scrolling. */
export function KeyboardScrollView({ children, footer, onFocus, onBlur, onLayout, ...props }: ScrollViewProps & { footer?: React.ReactNode }) {
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const focusWithin = useRef(false);
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);
  const reveal = useCallback(() => {
    if (Platform.OS === "web" || !focusWithin.current || !Keyboard.isVisible()) return;
    const focused = TextInput.State.currentlyFocusedInput();
    if (focused) scroll.current?.scrollResponderScrollNativeHandleToKeyboard(focused, footerHeight + insets.top + 16, true);
  }, [footerHeight, insets.top]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const listener = Keyboard.addListener("keyboardDidShow", reveal);
    return () => listener.remove();
  }, [reveal]);
  const content = <ScrollView {...props} ref={scroll} style={[{ flex: 1 }, props.style]}
    keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
    onFocus={event => { focusWithin.current = true; onFocus?.(event); requestAnimationFrame(reveal); }}
    onBlur={event => { focusWithin.current = false; onBlur?.(event); }}
    onLayout={event => { onLayout?.(event); reveal(); }}>
    {children}
    {Platform.OS === "web" && footer}
  </ScrollView>;
  if (Platform.OS === "web") return content;
  return <KeyboardAvoidingView style={{ flex: 1 }} enabled={Platform.OS === "ios"} behavior="padding" keyboardVerticalOffset={insets.top}>
    {content}
    {footer && <View onLayout={event => setFooterHeight(event.nativeEvent.layout.height)} style={{ width: "100%", maxWidth: 640, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 12, backgroundColor: C.paper }}>{footer}</View>}
  </KeyboardAvoidingView>;
}
export function Screen({ children, scrollEnabled = true, footer }: { children: React.ReactNode; scrollEnabled?: boolean; footer?: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <KeyboardScrollView scrollEnabled={scrollEnabled} footer={footer}
        contentContainerStyle={{
          flexGrow: 1,
          width: "100%",
          maxWidth: 640,
          alignSelf: "center",
          padding: 24,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </KeyboardScrollView>
    </SafeAreaView>
  );
}
export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: serif, fontSize: 28, color: C.ink }}>
      {children}
    </Text>
  );
}
export function Body({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: sans, fontSize: 16, color: C.ink }}>
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: C.blue,
        borderRadius: 14,
        padding: 16,
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: "white", fontWeight: "700" }}>{title}</Text>
    </Pressable>
  );
}
export function Bar({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "flex-start",
        gap: 8,
        alignItems: "center",
      }}
    >
      {children}
    </View>
  );
}
export function BackButton({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
    <ArtIcon name="back" size={25} />
  </Pressable>;
}
