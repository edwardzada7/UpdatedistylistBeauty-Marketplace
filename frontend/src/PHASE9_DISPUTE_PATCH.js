/**
 * Phase 9 Enhancement: Dispute Resolution for AdminDashboardScreen
 * 
 * Add these imports at the top of AdminDashboardScreen.jsx (line 38):
 */

// Add to imports:
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { noShowAPI } from "@/services/api";

/**
 * Add these state variables after line 60:
 */
const [selectedDispute, setSelectedDispute] = useState(null);
const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
const [resolution, setResolution] = useState("favor_customer");
const [adminNotes, setAdminNotes] = useState("");
const [resolving, setResolving] = useState(false);

/**
 * Add this function after loadDashboard (around line 120):
 */
const handleResolveDispute = useCallback(async () => {
  if (!selectedDispute || !adminKey) return;
  
  try {
    setResolving(true);
    await noShowAPI.adminResolve(adminKey, {
      booking_id: selectedDispute.id,
      resolution,
      admin_notes: adminNotes || undefined,
    });
    
    toast.success("Dispute resolved successfully");
    setDisputeDialogOpen(false);
    loadDashboard(adminKey); // Refresh data
  } catch (e) {
    toast.error(e?.response?.data?.detail || "Failed to resolve dispute");
  } finally {
    setResolving(false);
  }
}, [selectedDispute, adminKey, resolution, adminNotes, loadDashboard]);

/**
 * Update the no-shows TableRow (around line 458) to add onClick:
 */
<TableRow 
  key={b.id} 
  data-testid={`admin-noshow-row-${b.id}`}
  onClick={() => {
    if (b.status === "disputed" || b.dispute_opened) {
      setSelectedDispute(b);
      setResolution("favor_customer");
      setAdminNotes("");
      setDisputeDialogOpen(true);
    }
  }}
  className={b.status === "disputed" ? "cursor-pointer hover:bg-gray-50" : ""}
>

/**
 * Add this Dialog component before the closing </div> of AdminDashboardScreen (around line 658):
 */

{/* Dispute Resolution Dialog */}
<Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Resolve No-Show Dispute</DialogTitle>
    </DialogHeader>
    
    {selectedDispute && (
      <div className="space-y-4">
        <div className="bg-gray-50 p-3 rounded-lg text-sm">
          <p><strong>Booking ID:</strong> {selectedDispute.id}</p>
          <p><strong>Customer:</strong> {selectedDispute.customer_name || "—"}</p>
          <p><strong>Provider:</strong> {selectedDispute.provider_name || "—"}</p>
          <p><strong>Service:</strong> {selectedDispute.service_title || "—"}</p>
          <p><strong>Amount:</strong> {CURRENCY}{selectedDispute.price?.toLocaleString() || "0"}</p>
        </div>

        <div>
          <Label>Resolution</Label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="favor_customer">Favor Customer (Refund)</option>
            <option value="favor_provider">Favor Provider (Release Payment)</option>
            <option value="split">Split 50/50</option>
            <option value="dismiss">Dismiss Dispute</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {resolution === "favor_customer" && "Refund escrow to customer, mark provider no-showed"}
            {resolution === "favor_provider" && "Release escrow to provider, mark customer no-showed"}
            {resolution === "split" && "Split escrow 50/50 between parties"}
            {resolution === "dismiss" && "Close dispute, restore booking to confirmed"}
          </p>
        </div>

        <div>
          <Label>Admin Notes (Optional)</Label>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Add notes about resolution decision..."
            rows={3}
          />
        </div>
      </div>
    )}

    <DialogFooter>
      <Button variant="outline" onClick={() => setDisputeDialogOpen(false)} disabled={resolving}>
        Cancel
      </Button>
      <Button onClick={handleResolveDispute} disabled={resolving}>
        {resolving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Resolve Dispute
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

/**
 * INSTALLATION INSTRUCTIONS:
 * 
 * 1. Add imports at top of AdminDashboardScreen.jsx
 * 2. Add state variables after line 60
 * 3. Add handleResolveDispute function after loadDashboard
 * 4. Update TableRow in no-shows section to add onClick handler
 * 5. Add Dialog component before closing </div>
 * 
 * This enables admins to click disputed bookings and resolve them with
 * 4 resolution options: favor customer, favor provider, split, or dismiss.
 */
