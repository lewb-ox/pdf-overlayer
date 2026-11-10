import { ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from './theme';

export function ThemeControl() {
  const { preference, changePreference } = useTheme();
  const Icon = preference === 'system' ? Monitor : preference === 'dark' ? Moon : Sun;
  return <label className="theme-control" title={`Colour theme: ${preference === 'system' ? 'follow system' : preference}`}>
    <Icon size={15} aria-hidden="true"/>
    <select aria-label="Colour theme" value={preference} onChange={event => changePreference(event.target.value as ThemePreference)}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
    <ChevronDown size={12} className="theme-chevron" aria-hidden="true"/>
  </label>;
}
