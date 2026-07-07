"use client";

import { useState } from "react";
import { apiPost } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }
    setLoading(true);
    try {
      await apiPost("/api/auth/change-password", { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>Update the password used to sign in to your account.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {error ? (
            <div className="rounded-lg border border-[#fecaca] bg-[#fee2e2] px-3 py-2.5 text-[13px] text-red">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-lg border border-[#86efac] bg-[#dcfce7] px-3 py-2.5 text-[13px] text-green">
              Password changed successfully.
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="cp-current">Current Password</Label>
            <Input
              id="cp-current"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cp-new">New Password</Label>
            <Input
              id="cp-new"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cp-confirm">Confirm New Password</Label>
            <Input
              id="cp-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading} className="bg-brand text-white hover:bg-brand-d">
              {loading ? "Saving..." : "Save Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
