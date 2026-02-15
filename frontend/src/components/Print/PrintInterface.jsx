import React from 'react';
import { Printer } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrint } from './usePrint';

// ✅ import helpers from ONE place
import { getFileExt, getFileIcon } from './printUtils';

import { 
  QRScannerView, 
  ConnectView, 
  FileUploadView, 
  PaymentView, 
  PrintingView, 
  CompletedView,
  LogTerminal 
} from './PrintViews';

export function PrintInterface() {
  const printState = usePrint();
  const { status, logs } = printState;

  // Pass helpers + hook state to views
  const viewProps = {
    ...printState,
    getFileExt,
    getFileIcon
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-card/90 backdrop-blur-xl border border-border shadow-2xl rounded-3xl">
        <CardHeader className="space-y-1 pb-4 border-b border-border">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <div className="w-10 h-10 bg-white text-black rounded-xl flex items-center justify-center shadow-lg">
              <Printer className="h-6 w-6" />
            </div>
            <span className="text-foreground">JusPri</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          
          {/* VIEW 1: Scanner */}
          {status === 'IDLE' && <QRScannerView {...viewProps} />}

          {/* VIEW 2: Connect */}
          {(status === 'SCANNED' || status === 'CONNECTING' || status === 'ERROR') && (
            <ConnectView {...viewProps} />
          )}

          {/* VIEW 3: Upload */}
          {(status === 'CONNECTED' || status === 'CALCULATING') && (
            <FileUploadView {...viewProps} />
          )}

          {/* VIEW 4: Payment */}
          {status === 'PAYMENT' && <PaymentView {...viewProps} />}

          {/* VIEW 5: Printing */}
          {status === 'PRINTING' && <PrintingView />}

          {/* VIEW 6: Done */}
          {status === 'COMPLETED' && <CompletedView {...viewProps} />}

          {/* Logs */}
          <LogTerminal logs={logs} />
        </CardContent>
      </Card>
    </div>
  );
}
