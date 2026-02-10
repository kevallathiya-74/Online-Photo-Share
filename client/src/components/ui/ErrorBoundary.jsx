import { Component } from 'react';
import { Alert, AlertDescription } from './Alert';
import { Button } from './Button';

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4">
                    <div className="max-w-md w-full space-y-4">
                        <Alert variant="destructive">
                            <AlertDescription>
                                <h3 className="font-semibold mb-2">Something went wrong</h3>
                                <p className="text-sm mb-4">
                                    {this.state.error?.message || 'An unexpected error occurred'}
                                </p>
                                <Button
                                    onClick={() => window.location.reload()}
                                    size="sm"
                                >
                                    Reload Page
                                </Button>
                            </AlertDescription>
                        </Alert>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
