import React from 'react';
import type { SeverityLevel, RunStatus, Plausibility } from '../../types';
import { AlertCircle, AlertTriangle, CheckCircle, Info, ShieldAlert, XCircle, Clock } from 'lucide-react';

interface BadgeProps {
  type?: 'severity' | 'status' | 'plausibility' | 'custom';
  severity?: SeverityLevel;
  status?: RunStatus;
  plausibility?: Plausibility;
  label?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  severity,
  status,
  plausibility,
  label,
  className = '',
}) => {
  if (severity) {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className={`badge badge-critical ${className}`}>
            <ShieldAlert size={12} />
            <span>CRITICAL</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className={`badge badge-high ${className}`}>
            <AlertTriangle size={12} />
            <span>HIGH</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className={`badge badge-medium ${className}`}>
            <AlertCircle size={12} />
            <span>MEDIUM</span>
          </span>
        );
      case 'INFORMATIONAL':
        return (
          <span className={`badge badge-info ${className}`}>
            <Info size={12} />
            <span>INFO</span>
          </span>
        );
    }
  }

  if (status) {
    switch (status) {
      case 'FAIL':
        return (
          <span className={`badge badge-critical ${className}`}>
            <XCircle size={12} />
            <span>FAIL</span>
          </span>
        );
      case 'PASS':
        return (
          <span className={`badge badge-pass ${className}`}>
            <CheckCircle size={12} />
            <span>PASS</span>
          </span>
        );
      case 'RUNNING':
        return (
          <span className={`badge badge-info pulse-indicator ${className}`}>
            <Clock size={12} />
            <span>RUNNING</span>
          </span>
        );
      case 'QUEUED':
        return (
          <span className={`badge badge-medium ${className}`}>
            <Clock size={12} />
            <span>QUEUED</span>
          </span>
        );
      case 'NEEDS_CONTEXT':
        return (
          <span className={`badge badge-high ${className}`}>
            <AlertCircle size={12} />
            <span>NEEDS_CONTEXT</span>
          </span>
        );
      default:
        return (
          <span className={`badge badge-medium ${className}`}>
            <span>{status}</span>
          </span>
        );
    }
  }

  if (plausibility) {
    switch (plausibility) {
      case 'SUPPORTED':
        return (
          <span className={`badge badge-pass ${className}`}>
            <CheckCircle size={12} />
            <span>SUPPORTED</span>
          </span>
        );
      case 'WEAK':
        return (
          <span className={`badge badge-high ${className}`}>
            <AlertTriangle size={12} />
            <span>WEAK</span>
          </span>
        );
      case 'UNSUPPORTED':
        return (
          <span className={`badge badge-critical ${className}`}>
            <XCircle size={12} />
            <span>UNSUPPORTED</span>
          </span>
        );
    }
  }

  return (
    <span className={`badge badge-info ${className}`}>
      <span>{label}</span>
    </span>
  );
};
