import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { SymbolView } from 'expo-symbols';

import { AppShell } from '@/components/app-shell';
import { Card, FeedbackMessage, SectionHeader } from '@/components/ui';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const supportContacts = [
  { phone: '252686859656', label: '+252686859656' },
  { phone: '252619355156', label: '+252619355156' },
];

const questions = [
  {
    question: 'What should I do if a subscription payment stays pending?',
    answer: 'Wait up to 5 minutes while the app checks for an update. If it is still pending, contact support and include your payment reference. Do not start another checkout while the payment is pending.',
  },
  {
    question: 'How can I export my workspace data?',
    answer: 'Open More > Privacy & data, then choose the export format you need. The export is downloaded to your device.',
  },
  {
    question: 'Where can I manage account security?',
    answer: 'Open More > Security to review multi-factor authentication and active sessions. Some options depend on your workspace role.',
  },
  {
    question: 'How do I request account deletion?',
    answer: 'Open More > Privacy & data and submit a deletion request. Your account is not deleted until you complete the confirmation sent by email.',
  },
  {
    question: 'How do I import products?',
    answer: 'Open Inventory and use Bulk Import to select a supported spreadsheet file.',
  },
];

export function SupportScreen({ onBack }: { onBack?: () => void }) {
  const theme = useTheme();
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const openContact = async (phone: string, method: 'whatsapp' | 'phone') => {
    setLinkError(null);
    const url = method === 'whatsapp'
      ? `https://wa.me/${phone}?text=${encodeURIComponent('Hello, I need help with My Inventory.')}`
      : `tel:+${phone}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      setLinkError(error instanceof Error ? error.message : 'Unable to open the selected support option. Please try again.');
    }
  };

  return (
    <AppShell title="Support & help" subtitle="Get help with My Inventory." onBack={onBack}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <SectionHeader title="Contact support" detail="WhatsApp and phone support are available 9 AM–5 PM GMT+3." />
          {linkError ? <FeedbackMessage message={linkError} /> : null}
          <View style={styles.contacts}>
            {supportContacts.map((contact) => (
              <View key={contact.phone} style={[styles.contact, { borderColor: theme.border }]}>
                <Text style={[styles.phone, { color: theme.text }]}>{contact.label}</Text>
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`WhatsApp ${contact.label}`}
                    accessibilityHint="Opens a WhatsApp conversation with support"
                    onPress={() => void openContact(contact.phone, 'whatsapp')}
                    style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}
                  >
                    <WhatsAppIcon size={24} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${contact.label}`}
                    accessibilityHint="Calls this support number"
                    onPress={() => void openContact(contact.phone, 'phone')}
                    style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}
                  >
                    <SymbolView name={{ ios: 'phone', android: 'call', web: 'call' }} tintColor={theme.primaryStrong} size={22} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <View style={styles.faqSection}>
          <SectionHeader title="Frequently asked questions" detail="Quick answers to common account and app questions." />
          {questions.map(({ question, answer }) => {
            const expanded = expandedQuestion === question;
            return (
              <Card key={question} compact>
                <Text
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setExpandedQuestion(expanded ? null : question)}
                  style={[styles.question, { color: theme.text }]}
                >
                  {question} {expanded ? '−' : '+'}
                </Text>
                {expanded ? <Text style={[styles.answer, { color: theme.textSecondary }]}>{answer}</Text> : null}
              </Card>
            );
          })}
        </View>

        <Text style={[styles.hours, { color: theme.textMuted }]}>Support hours: 9 AM–5 PM GMT+3</Text>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four, paddingBottom: Spacing.five },
  card: { gap: Spacing.three },
  contacts: { gap: Spacing.two },
  contact: { gap: Spacing.two, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: Spacing.three },
  phone: { ...Typography.label },
  actions: { flexDirection: 'row', gap: Spacing.two },
  actionButton: { width: 48, height: 48, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  faqSection: { gap: Spacing.two },
  question: { ...Typography.label },
  answer: { ...Typography.body, marginTop: Spacing.two },
  hours: { ...Typography.caption, textAlign: 'center' },
});
