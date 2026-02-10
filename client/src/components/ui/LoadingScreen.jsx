import { Spinner } from './Spinner';
import { FileIcon } from 'lucide-react';

export function LoadingScreen({ message = 'Loading...' }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-6 animate-fade-in">
                {/* Logo */}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/25">
                    <FileIcon className="h-10 w-10 text-white" />
                </div>

                {/* Loading Spinner */}
                <div className="flex justify-center">
                    <Spinner size="xl" />
                </div>

                {/* Message */}
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold gradient-text">FileShare</h2>
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>
            </div>
        </div>
    );
}
