import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export function ScanView({ config, onScanComplete }) {
  const [scanning, setScanning] = useState(false);
  const [scanOptions, setScanOptions] = useState({
    resolution: 300,
    colorMode: 'RGB24',
    format: 'PDF'
  });

  const startScan = async () => {
    setScanning(true);
    
    try {
      // Create scan job
      const response = await axios.post(`${API_URL}/jobs/scan`, {
        kiosk_id: config.kiosk_id,
        scan_options: scanOptions
      });

      const jobId = response.data.job_id;

      // Poll for completion
      const interval = setInterval(async () => {
        const status = await axios.get(`${API_URL}/jobs/${jobId}`);
        
        if (status.data.status === 'COMPLETED') {
          clearInterval(interval);
          onScanComplete(status.data.output_file_url);
          setScanning(false);
        }
      }, 2000);

    } catch (error) {
      console.error('Scan failed:', error);
      setScanning(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-xl font-bold">Scan Document</h2>

      <div className="space-y-3">
        <div>
          <label>Resolution:</label>
          <select 
            value={scanOptions.resolution}
            onChange={e => setScanOptions({...scanOptions, resolution: +e.target.value})}
          >
            <option value={150}>150 DPI (Draft)</option>
            <option value={300}>300 DPI (Standard)</option>
            <option value={600}>600 DPI (High Quality)</option>
          </select>
        </div>

        <div>
          <label>Color Mode:</label>
          <select 
            value={scanOptions.colorMode}
            onChange={e => setScanOptions({...scanOptions, colorMode: e.target.value})}
          >
            <option value="RGB24">Color</option>
            <option value="Grayscale8">Grayscale</option>
            <option value="BlackAndWhite1">Black & White</option>
          </select>
        </div>
      </div>

      <Button 
        onClick={startScan} 
        disabled={scanning}
        className="w-full"
      >
        {scanning ? (
          <>
            <Loader2 className="animate-spin mr-2" />
            Scanning...
          </>
        ) : (
          'Start Scan'
        )}
      </Button>

      <p className="text-sm text-muted-foreground">
        Place your document face-down on the scanner bed before clicking "Start Scan"
      </p>
    </Card>
  );
}
