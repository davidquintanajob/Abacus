import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../common/Card';
import { useTheme } from '../../theme/ThemeContext';

export const MetricCard = ({ 
  title, 
  value, 
  change, 
  icon, 
  variant = 'default',
  chart 
}) => {
  const { colors } = useTheme();

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.outline }]}>{title}</Text>
        {change && (
          <Text style={[styles.change, { color: colors.secondary }]}>
            {change}
          </Text>
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.value, { color: colors.onSurface }]}>
          {value}
        </Text>
        
        {chart && (
          <View style={styles.chart}>
            {chart.map((height, index) => (
              <View
                key={index}
                style={[
                  styles.bar,
                  { 
                    backgroundColor: index === chart.length - 1 ? colors.secondary : colors.primaryContainer,
                    height: `${height * 100}%`
                  }
                ]}
              />
            ))}
          </View>
        )}
      </View>
      
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: colors.surfaceContainer }]}>
          <Text style={[styles.icon, { color: colors.primary }]}>{icon}</Text>
        </View>
      )}
    </Card>
  );
};

export const SmallMetricCard = ({ title, value, icon }) => {
  const { colors } = useTheme();

  return (
    <Card style={styles.smallCard}>
      <View style={[styles.iconContainer, { backgroundColor: colors.surfaceContainer }]}>
        <Text style={[styles.icon, { color: colors.primary }]}>{icon}</Text>
      </View>
      <Text style={[styles.smallTitle, { color: colors.outline }]}>{title}</Text>
      <Text style={[styles.smallValue, { color: colors.onSurface }]}>{value}</Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.05,
  },
  change: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 40,
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    lineHeight: 48,
    letterSpacing: -0.02,
  },
  chart: {
    flexDirection: 'row',
    gap: 4,
    height: 48,
    alignItems: 'flex-end',
  },
  bar: {
    width: 8,
    borderRadius: 9999,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 24,
  },
  smallCard: {
    minHeight: 100,
  },
  smallTitle: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'JetBrains Mono',
    letterSpacing: 0.05,
    marginBottom: 4,
  },
  smallValue: {
    fontSize: 24,
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    lineHeight: 32,
  },
});
