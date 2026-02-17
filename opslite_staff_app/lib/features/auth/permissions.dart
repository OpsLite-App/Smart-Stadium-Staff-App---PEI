enum Permission {
  viewMap,
  viewAlerts,
  viewTasks,
  viewChat,
  viewSOS,
  viewAnalytics,
  viewTeam,
}

const rolePermissions = {
  'security': {
    Permission.viewMap,
    Permission.viewAlerts,
    Permission.viewChat,
    Permission.viewSOS,
  },
  'cleaning': {
    Permission.viewMap,
    Permission.viewTasks,
    Permission.viewChat,
  },
  'medic': {
    Permission.viewMap,
    Permission.viewSOS,
    Permission.viewChat,
  },
  'supervisor': {
    Permission.viewMap,
    Permission.viewAlerts,
    Permission.viewAnalytics,
    Permission.viewTeam,
  },
};
