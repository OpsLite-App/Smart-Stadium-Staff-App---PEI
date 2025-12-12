import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import DashboardCard from '../components/DashboardCard';

export default function Dashboard() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.grid}>
        <DashboardCard title="Vendas" value="1.200" />
        <DashboardCard title="Usuários" value="350" />
        <DashboardCard title="Receita" value="$5.400" />
        <DashboardCard title="Tarefas" value="23" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
