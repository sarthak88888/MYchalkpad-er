import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { getUserSession } from '@/lib/storage';
import { COLORS } from '@/lib/theme';

export default function TabsLayout() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserSession().then((session) => {
      setRole(session.role);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!role) return <Redirect href="/" />;
  if (role === 'super_admin' || role === 'principal')
    return <Redirect href="/admin" />;
  if (role === 'class_teacher') return <Redirect href="/teacher" />;
  if (role === 'parent') return <Redirect href="/parent" />;
  if (role === 'bus_driver') return <Redirect href="/driver" />;
  if (role === 'accountant') return <Redirect href="/accountant" />;
  return <Redirect href="/" />;
}
```

---

**✅ FILE GROUP 3 COMPLETE**

**Folder summary:**
```
app/
├── _layout.tsx
├── index.tsx
└── (tabs)/
    └── _layout.tsx