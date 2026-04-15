export const examplePageTemplate = `"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Loader2, CheckCircle, AlertCircle, Zap } from "lucide-react";

//import { protocol as simpleTxProtocol } from "@tx3/protocol";
import { Client } from "@tx3/protocol";
const simpleTxProtocol = new Client({
  endpoint: process.env.NEXT_PUBLIC_TRP_ENDPOINT as string,
  headers: {
    'api_key': process.env.NEXT_PUBLIC_TRP_API_KEY || '',
  },
  envArgs: {}, // Optional environment arguments
});

export default function TestTx3() {
  const [isLoading, setIsLoading] = useState(false);
  const [txResult, setTxResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const alice = "addr_test1vqsj204gwmxklmvkkd8jtxy9jc8qp70dxjel3w2555cnjwcefzlzc";
  const bob = "addr_test1vp044lyrq26h5gv8rhtqp5y8w4ndge9tvdu65t5qee58kaqthdt2h";

  const onClick = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setTxResult("");

    try {
      const tx = await simpleTxProtocol.transferTx({
        sender: alice,
        receiver: bob,
        quantity: 1000000, // 1 ADA in lovelace
      });
      setTxResult(tx.tx);
      console.log("Transaction CBOR:", tx);
    } catch (error) {
      console.error("Error resolving tx:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (txResult) {
      try {
        await navigator.clipboard.writeText(JSON.stringify(txResult, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  }, [txResult]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              TX3 Protocol Demo
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Demonstrate the TX3 protocol by generating a transaction CBOR for transferring ADA between addresses (submission not included in this example)
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Transaction Details Card */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline">Transaction Details</Badge>
              </CardTitle>
              <CardDescription>
                Configure and execute a simple ADA transfer transaction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sender">Sender Address</Label>
                <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
                  {alice}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="receiver">Receiver Address</Label>
                <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
                  {bob}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">1 ADA</Badge>
                  <span className="text-sm text-muted-foreground">(1,000,000 lovelace)</span>
                </div>
              </div>

              <Separator />

              <Button 
                onClick={onClick}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Transaction...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Generate TX3 Transaction
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Card */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline">Transaction Result</Badge>
              </CardTitle>
              <CardDescription>
                Generated transaction CBOR and metadata
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {txResult && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Transaction generated successfully!
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Transaction CBOR</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyToClipboard}
                        className="h-8"
                      >
                        {copied ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <Textarea
                      value={JSON.stringify(txResult, null, 2)}
                      readOnly
                      className="font-mono text-xs min-h-[200px] resize-none"
                    />
                  </div>
                </div>
              )}

              {!txResult && !error && !isLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click &quot;Generate TX3 Transaction&quot; to see the result</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
`;