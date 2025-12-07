/**
 * FileUpload Component
 *
 * Drag-and-drop file upload component for CSV/Excel files.
 */

import React, { useCallback, useState, useRef } from 'react';
import clsx from 'clsx';
import { useDataSpecContext } from '../context/DataSpecContext';

export interface FileUploadProps {
  /** Optional class name */
  className?: string;
  /** Accepted file types */
  accept?: string;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Show file preview */
  showPreview?: boolean;
  /** Custom drop zone content */
  dropZoneContent?: React.ReactNode;
  /** Callback when file is selected */
  onFileSelect?: (file: File) => void;
  /** Callback when file is removed */
  onFileRemove?: () => void;
  /** Callback on validation error */
  onError?: (error: string) => void;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file icon based on type
 */
function FileIcon({ type }: { type: string }) {
  const isCsv = type.includes('csv') || type.includes('text/plain');
  const isExcel = type.includes('excel') || type.includes('spreadsheet');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx(
        'dataspec-file-upload__file-icon',
        isCsv && 'dataspec-file-upload__file-icon--csv',
        isExcel && 'dataspec-file-upload__file-icon--excel'
      )}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      {isCsv && (
        <>
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </>
      )}
      {isExcel && (
        <>
          <rect x="8" y="12" width="8" height="6" />
          <line x1="12" y1="12" x2="12" y2="18" />
          <line x1="8" y1="15" x2="16" y2="15" />
        </>
      )}
    </svg>
  );
}

/**
 * Upload icon
 */
function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17,8 12,3 7,8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

/**
 * FileUpload Component
 */
export function FileUpload({
  className,
  accept = '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
  maxSize = 10 * 1024 * 1024, // 10MB default
  disabled = false,
  showPreview = true,
  dropZoneContent,
  onFileSelect,
  onFileRemove,
  onError,
}: FileUploadProps) {
  const { fileUpload, selectedSpec, setFile, clearFile, setError } = useDataSpecContext();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Validate file
  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`;
    }

    // Check file type
    const acceptedTypes = accept.split(',').map(t => t.trim().toLowerCase());
    const fileType = file.type.toLowerCase();
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    const isValidType = acceptedTypes.some(type => {
      if (type.startsWith('.')) {
        return fileExt === type;
      }
      return fileType === type || fileType.includes(type.replace('*', ''));
    });

    if (!isValidType) {
      return 'Invalid file type. Please upload a CSV or Excel file.';
    }

    return null;
  }, [accept, maxSize]);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      setError(error);
      onError?.(error);
      return;
    }

    setFile(file);
    onFileSelect?.(file);
  }, [validateFile, setFile, setError, onFileSelect, onError]);

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [disabled, handleFileSelect]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Handle remove
  const handleRemove = useCallback(() => {
    clearFile();
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onFileRemove?.();
  }, [clearFile, onFileRemove]);

  // Handle click to browse
  const handleBrowseClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  // Check if spec is selected
  const isSpecSelected = !!selectedSpec;

  return (
    <div className={clsx('dataspec-file-upload', className)}>
      {/* Hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        disabled={disabled || !isSpecSelected}
        className="dataspec-file-upload__input"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* No spec selected warning */}
      {!isSpecSelected && (
        <div className="dataspec-file-upload__warning">
          Please select a specification before uploading a file
        </div>
      )}

      {/* Drop zone */}
      {!fileUpload.file ? (
        <div
          className={clsx(
            'dataspec-file-upload__dropzone',
            isDragging && 'dataspec-file-upload__dropzone--dragging',
            disabled && 'dataspec-file-upload__dropzone--disabled',
            !isSpecSelected && 'dataspec-file-upload__dropzone--no-spec'
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          role="button"
          tabIndex={disabled || !isSpecSelected ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleBrowseClick();
            }
          }}
          aria-label="Upload file"
        >
          {dropZoneContent || (
            <>
              <div className="dataspec-file-upload__icon">
                <UploadIcon />
              </div>
              <div className="dataspec-file-upload__text">
                <p className="dataspec-file-upload__title">
                  {isDragging ? 'Drop file here' : 'Drag & drop your file here'}
                </p>
                <p className="dataspec-file-upload__subtitle">
                  or <span className="dataspec-file-upload__browse">browse</span> to select
                </p>
              </div>
              <div className="dataspec-file-upload__hint">
                Supports CSV and Excel files up to {formatFileSize(maxSize)}
              </div>
            </>
          )}
        </div>
      ) : (
        /* File preview */
        showPreview && (
          <div className="dataspec-file-upload__preview">
            <div className="dataspec-file-upload__file">
              <FileIcon type={fileUpload.fileType} />
              <div className="dataspec-file-upload__file-info">
                <span className="dataspec-file-upload__file-name">{fileUpload.fileName}</span>
                <span className="dataspec-file-upload__file-size">
                  {formatFileSize(fileUpload.fileSize)}
                </span>
              </div>
              <button
                type="button"
                className="dataspec-file-upload__remove"
                onClick={handleRemove}
                disabled={disabled}
                aria-label="Remove file"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Upload status */}
            {fileUpload.status !== 'idle' && fileUpload.status !== 'complete' && (
              <div className="dataspec-file-upload__status">
                {fileUpload.status === 'uploading' && (
                  <>
                    <div className="dataspec-file-upload__progress">
                      <div
                        className="dataspec-file-upload__progress-bar"
                        style={{ width: `${fileUpload.uploadProgress}%` }}
                      />
                    </div>
                    <span>{fileUpload.uploadProgress}% uploaded</span>
                  </>
                )}
                {fileUpload.status === 'processing' && (
                  <span>Processing file...</span>
                )}
                {fileUpload.status === 'error' && fileUpload.error && (
                  <span className="dataspec-file-upload__error">{fileUpload.error}</span>
                )}
              </div>
            )}

            {/* Replace file button */}
            <button
              type="button"
              className="dataspec-file-upload__replace"
              onClick={handleBrowseClick}
              disabled={disabled}
            >
              Replace file
            </button>
          </div>
        )
      )}
    </div>
  );
}

export default FileUpload;
