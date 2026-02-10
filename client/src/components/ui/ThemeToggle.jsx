import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Button } from './Button';

export function ThemeToggle({ className = '' }) {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className={`w-9 h-9 p-0 ${className}`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
            ) : (
                <Moon className="h-4 w-4" />
            )}
        </Button>
    );
}
