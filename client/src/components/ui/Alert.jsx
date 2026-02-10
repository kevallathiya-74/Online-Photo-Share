import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/helpers';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive bg-destructive/10',
        success: 'border-green-500/50 text-green-700 dark:text-green-400 [&>svg]:text-green-700 dark:[&>svg]:text-green-400 bg-green-500/10',
        warning: 'border-yellow-500/50 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-700 dark:[&>svg]:text-yellow-400 bg-yellow-500/10',
        info: 'border-blue-500/50 text-blue-700 dark:text-blue-400 [&>svg]:text-blue-700 dark:[&>svg]:text-blue-400 bg-blue-500/10'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

const Alert = React.forwardRef(({ className, variant, ...props }, ref) => {
  const Icon = {
    default: Info,
    destructive: XCircle,
    success: CheckCircle2,
    warning: AlertCircle,
    info: Info
  }[variant || 'default'];

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="h-4 w-4" />
      {props.children}
    </div>
  );
});
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('mb-1 font-medium leading-none tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
