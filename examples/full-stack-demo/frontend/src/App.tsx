/**
 * Full-Stack Demo App
 *
 * Demonstrates the complete DataSpec Engine React integration.
 */

import React, { useState, useCallback } from 'react';
import {
  DataSpecProvider,
  EntitySelector,
  FileUpload,
  PreviewTable,
  ImportProgress,
  useDataSpecContext,
} from '@dataspec-engine/react';

// Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ============================================================================
// Import Wizard Component
// ============================================================================

function ImportWizard() {
  // Use the context hook directly - it provides all state and methods
  const {
    fileUpload,
    preview: previewResult,
    isPreviewLoading,
    importProgress,
    importResult,
    error,
    selectEntity,
    selectSpec,
    setFile,
    generatePreview,
    executeImport,
    resetImport,
  } = useDataSpecContext();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);

  // Step navigation
  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  // Handle entity selection
  const handleEntitySelect = useCallback(
    (entity: { id: string; name: string }) => {
      setSelectedEntity(entity.id);
      selectEntity(entity as any);
      goToStep(2);
    },
    [selectEntity]
  );

  // Handle file upload
  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!selectedSpec) return;

      setFile(file);

      // Read file content for preview
      const reader = new FileReader();
      reader.onload = async () => {
        await generatePreview();
        goToStep(4);
      };
      reader.readAsText(file);
    },
    [selectedSpec, setFile, generatePreview]
  );

  // Handle import execution
  const handleExecuteImport = useCallback(async () => {
    if (!selectedSpec || !fileUpload.file) return;

    await executeImport();
    goToStep(5);
  }, [selectedSpec, fileUpload.file, executeImport]);

  // Reset wizard
  const handleReset = () => {
    resetImport();
    setSelectedEntity(null);
    setSelectedSpec(null);
    setCurrentStep(1);
  };

  // Check if import is in progress
  const isImporting = importProgress.status === 'in_progress';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-center">
        DataSpec Import Wizard
      </h1>

      {/* Progress Steps */}
      <div className="flex justify-between mb-8">
        {['Entity', 'Spec', 'Upload', 'Preview', 'Complete'].map((step, i) => (
          <div
            key={step}
            className={`flex items-center ${
              i + 1 <= currentStep ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                i + 1 <= currentStep
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300'
              }`}
            >
              {i + 1}
            </div>
            <span className="ml-2 hidden sm:inline">{step}</span>
            {i < 4 && (
              <div
                className={`w-12 h-0.5 mx-2 ${
                  i + 1 < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Step 1: Entity Selection */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Select Entity</h2>
            <p className="text-gray-600 mb-4">
              Choose the type of data you want to import.
            </p>
            <EntitySelector
              mode="cards"
              onSelect={handleEntitySelect}
            />
          </div>
        )}

        {/* Step 2: Spec Selection */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Select Import Spec</h2>
            <p className="text-gray-600 mb-4">
              Choose the import specification for {selectedEntity}.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  const specId = `${selectedEntity}-import-v1`;
                  setSelectedSpec(specId);
                  selectSpec({ id: specId, name: `${selectedEntity} Import` } as any);
                  goToStep(3);
                }}
                className="w-full p-4 border rounded-lg text-left hover:bg-gray-50 transition"
              >
                <div className="font-medium">{selectedEntity} Import</div>
                <div className="text-sm text-gray-500">
                  Standard import with validation
                </div>
              </button>
            </div>
            <button
              onClick={() => goToStep(1)}
              className="mt-4 text-blue-600 hover:underline"
            >
              &larr; Back to entity selection
            </button>
          </div>
        )}

        {/* Step 3: File Upload */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Upload File</h2>
            <p className="text-gray-600 mb-4">
              Upload your CSV file to import.
            </p>
            <FileUpload
              accept={['.csv']}
              maxSize={10 * 1024 * 1024}
              onUpload={handleFileUpload}
            />
            {isImporting && (
              <div className="mt-4 text-center text-gray-600">
                Processing file...
              </div>
            )}
            <button
              onClick={() => goToStep(2)}
              className="mt-4 text-blue-600 hover:underline"
            >
              &larr; Back to spec selection
            </button>
          </div>
        )}

        {/* Step 4: Preview */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Preview Import</h2>
            {isPreviewLoading ? (
              <div className="text-center py-8">Loading preview...</div>
            ) : error ? (
              <div className="text-red-600 py-8">{error}</div>
            ) : previewResult ? (
              <>
                <div className="mb-4 flex gap-4">
                  <div className="px-4 py-2 bg-green-100 text-green-800 rounded">
                    Valid: {previewResult.validRows}
                  </div>
                  <div className="px-4 py-2 bg-red-100 text-red-800 rounded">
                    Invalid: {previewResult.invalidRows}
                  </div>
                  <div className="px-4 py-2 bg-gray-100 text-gray-800 rounded">
                    Total: {previewResult.totalRows}
                  </div>
                </div>
                <PreviewTable
                  data={previewResult.rows}
                  columns={previewResult.columns}
                  showMasking={true}
                />
                <div className="mt-6 flex gap-4">
                  <button
                    onClick={() => goToStep(3)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    &larr; Upload different file
                  </button>
                  <button
                    onClick={handleExecuteImport}
                    disabled={previewResult.validRows === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Execute Import ({previewResult.validRows} rows)
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Step 5: Complete */}
        {currentStep === 5 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Import Complete</h2>
            {isImporting ? (
              <ImportProgress
                status="importing"
                progress={50}
              />
            ) : error ? (
              <div className="text-red-600 py-8">{error}</div>
            ) : importResult ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">&#10003;</div>
                <div className="text-xl font-medium text-green-600">
                  Import Successful!
                </div>
                <div className="mt-4 text-gray-600">
                  <div>Inserted: {importResult.successfulRows || 0} rows</div>
                  <div>Failed: {importResult.failedRows || 0} rows</div>
                  <div>Total: {importResult.totalRows || 0} rows</div>
                </div>
                <button
                  onClick={handleReset}
                  className="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Start New Import
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main App
// ============================================================================

function App() {
  return (
    <DataSpecProvider
      config={{
        api: {
          baseUrl: API_BASE_URL,
        },
      }}
    >
      <div className="min-h-screen bg-gray-100">
        <ImportWizard />
      </div>
    </DataSpecProvider>
  );
}

export default App;
