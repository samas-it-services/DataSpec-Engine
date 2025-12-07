/**
 * FileUpload Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { DataSpecProvider, useDataSpecContext } from '../context/DataSpecContext';
import { FileUpload } from '../components/FileUpload';
import { DataSpecProviderConfig } from '../types';

// Mock fetch
global.fetch = jest.fn();

const mockConfig: DataSpecProviderConfig = {
  api: {
    baseUrl: 'http://localhost:3000',
  },
};

// Helper to set up context with selected spec
function SetupSpec({ children }: { children: React.ReactNode }) {
  const context = useDataSpecContext();
  React.useEffect(() => {
    // Manually set selected spec for testing
    context.selectSpec({
      id: 'spec-1',
      name: 'Test Spec',
      entity: 'test',
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }, []);
  return <>{children}</>;
}

const renderWithProvider = (ui: React.ReactElement, withSpec = true) => {
  if (withSpec) {
    return render(
      <DataSpecProvider config={mockConfig}>
        <SetupSpec>{ui}</SetupSpec>
      </DataSpecProvider>
    );
  }
  return render(
    <DataSpecProvider config={mockConfig}>
      {ui}
    </DataSpecProvider>
  );
};

describe('FileUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('rendering', () => {
    it('should render drop zone', () => {
      renderWithProvider(<FileUpload />);

      expect(screen.getByText(/Drag & drop your file here/i)).toBeInTheDocument();
    });

    it('should show warning when no spec is selected', () => {
      renderWithProvider(<FileUpload />, false);

      expect(screen.getByText(/Please select a specification before uploading/i)).toBeInTheDocument();
    });

    it('should show browse button', () => {
      renderWithProvider(<FileUpload />);

      expect(screen.getByText('browse')).toBeInTheDocument();
    });

    it('should show file size hint', () => {
      renderWithProvider(<FileUpload maxSize={5 * 1024 * 1024} />);

      expect(screen.getByText(/up to 5 MB/i)).toBeInTheDocument();
    });
  });

  describe('file selection', () => {
    it('should accept CSV files', async () => {
      const onFileSelect = jest.fn();
      renderWithProvider(<FileUpload onFileSelect={onFileSelect} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['col1,col2\nval1,val2'], 'test.csv', { type: 'text/csv' });

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(onFileSelect).toHaveBeenCalledWith(file);
      });
    });

    it('should accept Excel files', async () => {
      const onFileSelect = jest.fn();
      renderWithProvider(<FileUpload onFileSelect={onFileSelect} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['excel content'], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(onFileSelect).toHaveBeenCalledWith(file);
      });
    });

    it('should reject files exceeding max size', async () => {
      const onError = jest.fn();
      renderWithProvider(<FileUpload maxSize={100} onError={onError} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const largeContent = 'x'.repeat(200);
      const file = new File([largeContent], 'large.csv', { type: 'text/csv' });

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('exceeds maximum'));
      });
    });
  });

  describe('drag and drop', () => {
    it('should highlight drop zone on drag enter', async () => {
      renderWithProvider(<FileUpload />);

      const dropZone = screen.getByRole('button', { name: /upload file/i });

      await act(async () => {
        fireEvent.dragEnter(dropZone, {
          dataTransfer: { files: [] },
        });
      });

      expect(dropZone).toHaveClass('dataspec-file-upload__dropzone--dragging');
    });

    it('should remove highlight on drag leave', async () => {
      renderWithProvider(<FileUpload />);

      const dropZone = screen.getByRole('button', { name: /upload file/i });

      await act(async () => {
        fireEvent.dragEnter(dropZone, { dataTransfer: { files: [] } });
      });

      await act(async () => {
        fireEvent.dragLeave(dropZone, { dataTransfer: { files: [] } });
      });

      expect(dropZone).not.toHaveClass('dataspec-file-upload__dropzone--dragging');
    });

    it('should accept dropped files', async () => {
      const onFileSelect = jest.fn();
      renderWithProvider(<FileUpload onFileSelect={onFileSelect} />);

      const dropZone = screen.getByRole('button', { name: /upload file/i });
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [file] },
        });
      });

      await waitFor(() => {
        expect(onFileSelect).toHaveBeenCalledWith(file);
      });
    });

    it('should not accept files when disabled', async () => {
      const onFileSelect = jest.fn();
      renderWithProvider(<FileUpload disabled onFileSelect={onFileSelect} />);

      const dropZone = screen.getByRole('button', { name: /upload file/i });
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [file] },
        });
      });

      expect(onFileSelect).not.toHaveBeenCalled();
    });
  });

  describe('file preview', () => {
    it('should show file preview after selection', async () => {
      renderWithProvider(<FileUpload showPreview />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test content'], 'data.csv', { type: 'text/csv' });

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('data.csv')).toBeInTheDocument();
      });
    });

    it('should show file size in preview', async () => {
      renderWithProvider(<FileUpload showPreview />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test content'], 'data.csv', { type: 'text/csv' });

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Bytes/)).toBeInTheDocument();
      });
    });

    it('should allow removing file', async () => {
      const onFileRemove = jest.fn();
      renderWithProvider(<FileUpload showPreview onFileRemove={onFileRemove} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test'], 'data.csv', { type: 'text/csv' });

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('data.csv')).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText('Remove file');

      await act(async () => {
        fireEvent.click(removeButton);
      });

      await waitFor(() => {
        expect(onFileRemove).toHaveBeenCalled();
      });
    });

    it('should show replace button in preview', async () => {
      renderWithProvider(<FileUpload showPreview />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test'], 'data.csv', { type: 'text/csv' });

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByText('Replace file')).toBeInTheDocument();
      });
    });
  });

  describe('custom drop zone content', () => {
    it('should render custom drop zone content', () => {
      const customContent = <div data-testid="custom-content">Custom Upload Area</div>;

      renderWithProvider(<FileUpload dropZoneContent={customContent} />);

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
      expect(screen.getByText('Custom Upload Area')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper aria labels', () => {
      renderWithProvider(<FileUpload />);

      const dropZone = screen.getByRole('button', { name: /upload file/i });
      expect(dropZone).toBeInTheDocument();
    });

    it('should be keyboard accessible', async () => {
      renderWithProvider(<FileUpload />);

      const dropZone = screen.getByRole('button', { name: /upload file/i });

      await act(async () => {
        fireEvent.keyDown(dropZone, { key: 'Enter' });
      });

      // Should trigger click on hidden input
      // (In a real environment, this would open file dialog)
    });

    it('should have tabIndex -1 when disabled', () => {
      renderWithProvider(<FileUpload disabled />);

      const dropZone = screen.getByRole('button', { name: /upload file/i });
      expect(dropZone).toHaveAttribute('tabIndex', '-1');
    });
  });
});
