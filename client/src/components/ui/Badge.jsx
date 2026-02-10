import * as React from 'react';
import { cn } from '../../utils/helpers';

const Badge = React.forwardRef(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/80',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
    outline: 'text-foreground border border-input',
    success: 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30',
    warning: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30',
    info: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
  };

  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
});
Badge.displayName = 'Badge';

export { Badge };
