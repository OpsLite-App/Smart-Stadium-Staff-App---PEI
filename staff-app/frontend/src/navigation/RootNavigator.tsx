// RootNavigator.tsx - VERSÃO CORRIGIDA
import React from 'react';
import TaskDetailsScreen from '../screens/TaskDetailsScreen';
import ChatScreen from '../screens/ChatScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/useAuthStore';
import { theme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import TeamScreen from '../screens/TeamScreen';
import LoginScreen from '../screens/LoginScreen';
import MapScreen from '../screens/MapScreen';
import AlertsScreen from '../screens/AlertsScreen';
import IncidentDetailsScreen from '../screens/IncidentDetailsScreen';
import EmergencyScreen from '../screens/EmergencyScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tabs para Security
function SecurityTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          backgroundColor: theme.colors.surface,
          borderTopColor: '#E5E7EB',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: any;

          if (route.name === 'Mapa') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Alertas') iconName = focused ? 'bell' : 'bell-outline';
          else if (route.name === 'Chat') iconName = focused ? 'chat' : 'chat-outline'; 
          else if (route.name === 'Emergência') iconName = 'alert-octagon';
          else if (route.name === 'Perfil') iconName = focused ? 'shield-account' : 'shield-account-outline';

          const iconColor = route.name === 'Emergência' ? theme.colors.error : color;

          return <MaterialCommunityIcons name={iconName} size={28} color={iconColor} />;
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarActiveBackgroundColor: route.name === 'Emergência' ? '#FFEBEE' : undefined,
      })}
    >
      <Tab.Screen name="Mapa" component={MapScreen} />
      <Tab.Screen name="Alertas" component={AlertsScreen} />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ tabBarLabel: 'Chat' }}
      />
      <Tab.Screen 
        name="Emergência" 
        component={EmergencyScreen} 
        options={{ tabBarLabel: 'SOS', tabBarActiveTintColor: theme.colors.error }}
      />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function CleaningTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          backgroundColor: theme.colors.surface,
          borderTopColor: '#E5E7EB',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: any;

          if (route.name === 'Mapa') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Tasks') iconName = focused ? 'clipboard-list' : 'clipboard-list-outline';
          else if (route.name === 'Chat') iconName = focused ? 'chat' : 'chat-outline'; 
          else if (route.name === 'Perfil') iconName = focused ? 'broom' : 'broom';

          return <MaterialCommunityIcons name={iconName} size={28} color={color} />;
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Mapa" component={MapScreen} />
      <Tab.Screen 
        name="Tasks" 
        component={AlertsScreen} 
        options={{ tabBarLabel: 'Tasks' }}
      />
      <Tab.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ tabBarLabel: 'Chat' }}
      />
      <Tab.Screen 
        name="Perfil" 
        component={ProfileScreen} 
        options={{ tabBarLabel: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}


// No SupervisorTabs, atualize os components:
function SupervisorTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#F59E0B',
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          backgroundColor: theme.colors.surface,
          borderTopColor: '#E5E7EB',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: any;

          if (route.name === 'Mapa') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Alertas') iconName = focused ? 'bell' : 'bell-outline';
          else if (route.name === 'Analytics') iconName = focused ? 'chart-box' : 'chart-box-outline';
          else if (route.name === 'Equipa') iconName = focused ? 'account-group' : 'account-group-outline';
          else if (route.name === 'Perfil') iconName = focused ? 'account-tie' : 'account-tie';

          const iconColor = route.name === 'Emergência' ? theme.colors.error : color;

          return <MaterialCommunityIcons name={iconName} size={28} color={iconColor} />;
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Mapa" component={MapScreen} />
      <Tab.Screen name="Alertas" component={AlertsScreen} />
      <Tab.Screen 
        name="Analytics" 
        component={AnalyticsScreen} // ✅ Atualizado
        options={{ tabBarLabel: 'Analytics' }}
      />
      <Tab.Screen 
        name="Equipa" 
        component={TeamScreen} // ✅ Atualizado
        options={{ tabBarLabel: 'Equipa' }}
      />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
export default function RootNavigator() {
  const user = useAuthStore((state) => state.user);

  const renderTabs = () => {
    switch(user?.role) {
      case 'Security':
        return <SecurityTabs />;
      case 'Cleaning':
        return <CleaningTabs />;
      case 'Supervisor':
        return <SupervisorTabs />;
      default:
        return null; // Retorna null enquanto não há user
    }
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="App">
              {() => renderTabs()}
            </Stack.Screen>
            <Stack.Screen name="IncidentDetails" component={IncidentDetailsScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="TaskDetails" component={TaskDetailsScreen} />


          </>
        ) : (
          <Stack.Screen name="Auth" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}