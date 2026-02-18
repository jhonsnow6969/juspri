// frontend/src/components/Print/PrintInterface.jsx
// Phase 1: Smart Printer Verification - full component ready to drop in.
// - Shows new status-check / printer-error / printer-warning views
// - Keeps existing flow for connect/upload/payment/printing/completed
// - Expects PrintViews to export the new views listed below

import React from 'react';
import { Printer } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePrint } from './usePrint';
import { getFileExt, getFileIcon } from './printUtils';

import {
  QRScannerView,
  ConnectView,
  FileUploadView,
  PaymentView,
  PrintingView,
  CompletedView,
  LogTerminal,
  // Phase 1 new views — make sure these exist in ./PrintViews
  StatusCheckView,
  PrinterErrorView,
  PrinterWarningView,
} from './PrintViews';

export function PrintInterface() {
  const printState = usePrint();
  const { status, logs } = printState;

  // Pass hook state + helpers down to child views
  const viewProps = {
    ...printState,
    getFileExt,
    getFileIcon,
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
          {/* VIEW: QR Scanner */}
          {status === 'IDLE' && <QRScannerView {...viewProps} />}

          {/* VIEW: Checking kiosk / printer status (Phase 1) */}
          {status === 'CHECKING_STATUS' && <StatusCheckView {...viewProps} />}

          {/* VIEW: Hard printer error (block) */}
          {status === 'PRINTER_ERROR' && (
            <PrinterErrorView
              printerStatusResult={printState.printerStatusResult}
              resetFlow={printState.resetFlow}
            />
          )}

          {/* VIEW: Soft printer warning (user can proceed or rescan) */}
          {status === 'PRINTER_WARNING' && (
            <PrinterWarningView
              proceedDespiteWarning={printState.proceedDespiteWarning}
              resetFlow={printState.rescanQR}
              printerStatusResult={printState.printerStatusResult}
            />
          )}

          {/* VIEW: Manual / fallback connect (shown after scan if user chooses or on connect errors) */}
          {(status === 'SCANNED' || status === 'CONNECTING' || status === 'ERROR') && (
            <ConnectView {...viewProps} />
          )}

          {/* VIEW: File upload / calculation */}
          {(status === 'CONNECTED' || status === 'CALCULATING') && (
            <FileUploadView {...viewProps} />
          )}

          {/* VIEW: Payment */}
          {status === 'PAYMENT' && <PaymentView {...viewProps} />}

          {/* VIEW: Printing progress */}
          {status === 'PRINTING' && <PrintingView {...viewProps} />}

          {/* VIEW: Completed / success */}
          {status === 'COMPLETED' && <CompletedView {...viewProps} />}

          {/* Logs - always visible */}
          <LogTerminal logs={logs} />
        </CardContent>
      </Card>
    </div>
  );
}

export default PrintInterface;
