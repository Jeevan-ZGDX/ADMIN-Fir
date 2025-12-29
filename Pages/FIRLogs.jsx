import React, { useEffect, useState } from "react";
import axios from "axios";
import styled, { createGlobalStyle } from "styled-components";
import { useNavigate } from "react-router-dom";
import Connect from "../Components/Connect";
import { useAuth } from "../context/AuthContext";

const GlobalStyle = createGlobalStyle`
  html, body, #root {
    height: 100%;
    width: 100%;
    margin: 0;
    padding: 0;
    background: #fff;
  }
`;

const FIRLogs = () => {
  const { account } = useAuth();
  const navigate = useNavigate();
  const [firs, setFIRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFIR, setSelectedFIR] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fetchFIRs = async () => {
    try {
      const response = await axios.get("http://localhost:5000/fir/logs");
      if (Array.isArray(response.data)) {
        setFIRs(response.data);
      } else {
        setFIRs([]);
      }
    } catch (err) {
      console.error("Error fetching FIRs:", err);
      setFIRs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFIRs();
    const interval = setInterval(fetchFIRs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectFIR = async (fir) => {
    try {
      const response = await axios.get(`http://localhost:5000/fir/case/${fir.firId}`);
      setSelectedFIR(response.data);
      setNewStatus(response.data.caseStatus || '');
      setShowDetails(true);
    } catch (err) {
      console.error("Error fetching case details:", err);
      setSelectedFIR(fir);
      setShowDetails(true);
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) {
      alert("Please select a status");
      return;
    }

    setUpdatingStatus(true);
    try {
      const response = await axios.post(
        `http://localhost:5000/fir/case/${selectedFIR.firId}/status`,
        { status: newStatus, note: statusNote }
      );
      
      setSelectedFIR({
        ...selectedFIR,
        caseStatus: newStatus,
        timeline: response.data.timeline
      });
      setStatusNote('');
      alert("Case status updated successfully!");
      fetchFIRs();
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleNewUpload = async () => {
    if (!uploadFile) {
      setUploadError('Please select a file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('type', uploadFile.type?.startsWith('audio') ? 'audio' : 'document');
      formData.append('description', `Case evidence - ${new Date().toLocaleString()}`);

      const response = await axios.post(
        `http://localhost:5000/fir/case/${selectedFIR.firId}/evidence`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        }
      );

      // Refresh the case details
      const updatedCase = await axios.get(`http://localhost:5000/fir/case/${selectedFIR.firId}`);
      setSelectedFIR(updatedCase.data);
      
      setUploadFile(null);
      setShowUploadModal(false);
      setUploadProgress(0);
      alert('File uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <GlobalStyle />
      <MainContainer>
        {/* Navbar */}
        <nav className="nav">
          <div className="container">
            <div className="btn" onClick={() => navigate("/")}>HOME</div>
            <div className="btn" onClick={() => navigate("/services")}>SERVICES</div>
            <div className="btn" onClick={() => navigate("/fir-logs")}>LOGS</div>
            <Connect className="btn" />
          </div>
        </nav>

        <Header>
          <h1>Evidence Storage & Case Management</h1>
          <p>Secure storage of FIR evidence with case progress tracking</p>
        </Header>

        {showDetails && selectedFIR ? (
          <DetailsPanel>
            <BackButton onClick={() => setShowDetails(false)}>← Back to List</BackButton>
            
            <CaseHeader>
              <div>
                <h2>Case: {selectedFIR.firId}</h2>
                <StatusBadge $status={selectedFIR.caseStatus || 'open'}>
                  {(selectedFIR.caseStatus || 'open').toUpperCase()}
                </StatusBadge>
              </div>
              <CaseMetadata>
                <p><strong>Opened:</strong> {new Date(selectedFIR.timestamp).toLocaleString()}</p>
                {selectedFIR.victim && <p><strong>Victim:</strong> {selectedFIR.victim}</p>}
              </CaseMetadata>
            </CaseHeader>

            <TabsContainer>
              <Tab>
                <TabHeader>
                  <h3>📋 Evidence Files</h3>
                  <NewUploadBtn onClick={() => setShowUploadModal(true)}>
                    + New Upload
                  </NewUploadBtn>
                </TabHeader>
                <EvidenceList>
                  {selectedFIR.evidence && selectedFIR.evidence.length > 0 ? (
                    selectedFIR.evidence.map((evidence, idx) => (
                      <EvidenceCard key={idx}>
                        <EvidenceInfo>
                          <EvidenceType>{(evidence.type || 'document').toUpperCase()}</EvidenceType>
                          <div>
                            <p><strong>{evidence.fileName}</strong></p>
                            <p className="hash" title={evidence.ipfsHash}>
                              Hash: {evidence.ipfsHash.substring(0, 20)}...
                            </p>
                            <p className="timestamp">
                              Uploaded: {new Date(evidence.uploadedAt).toLocaleString()}
                            </p>
                            {evidence.description && (
                              <p className="description">{evidence.description}</p>
                            )}
                          </div>
                        </EvidenceInfo>
                        <a 
                          href={`https://cloudflare-ipfs.com/ipfs/${evidence.ipfsHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="view-button"
                        >
                          View File
                        </a>
                      </EvidenceCard>
                    ))
                  ) : (
                    <p>No evidence files yet</p>
                  )}
                </EvidenceList>
              </Tab>

              <Tab>
                <h3>🔄 Case Status Update</h3>
                <StatusUpdateForm>
                  <FormGroup>
                    <label>Update Case Status:</label>
                    <select 
                      value={newStatus} 
                      onChange={(e) => setNewStatus(e.target.value)}
                      disabled={updatingStatus}
                    >
                      <option value="">-- Select Status --</option>
                      <option value="open">Open (New Case)</option>
                      <option value="in-progress">In Progress (Collecting Data)</option>
                      <option value="under-evaluation">Under Evaluation (Analysis)</option>
                      <option value="concluded">Concluded (Final)</option>
                    </select>
                  </FormGroup>

                  <FormGroup>
                    <label>Status Update Note:</label>
                    <textarea
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Add details about this status update..."
                      disabled={updatingStatus}
                      rows="4"
                    />
                  </FormGroup>

                  <UpdateButton
                    onClick={handleUpdateStatus}
                    disabled={updatingStatus || !newStatus}
                  >
                    {updatingStatus ? "Updating..." : "Update Case Status"}
                  </UpdateButton>
                </StatusUpdateForm>
              </Tab>

              <Tab>
                <h3>📅 Case Timeline</h3>
                <Timeline>
                  {selectedFIR.timeline && selectedFIR.timeline.length > 0 ? (
                    selectedFIR.timeline.map((entry, idx) => (
                      <TimelineEntry key={idx}>
                        <TimelineMarker $status={entry.status || 'open'} />
                        <TimelineContent>
                          <TimelineStatus $status={entry.status || 'open'}>
                            {(entry.status || 'open').toUpperCase()}
                          </TimelineStatus>
                          <TimelineTime>
                            {new Date(entry.timestamp).toLocaleString()}
                          </TimelineTime>
                          <TimelineNote>{entry.note}</TimelineNote>
                          {entry.evidenceCount && (
                            <TimelineEvidenceCount>
                              📁 Evidence count: {entry.evidenceCount}
                            </TimelineEvidenceCount>
                          )}
                        </TimelineContent>
                      </TimelineEntry>
                    ))
                  ) : (
                    <p>No timeline entries yet</p>
                  )}
                </Timeline>
              </Tab>
            </TabsContainer>

            {showUploadModal && (
              <UploadModal>
                <UploadModalContent>
                  <UploadModalHeader>
                    <h3>Upload New Evidence</h3>
                    <CloseButton onClick={() => setShowUploadModal(false)}>✕</CloseButton>
                  </UploadModalHeader>

                  <UploadForm>
                    <FormGroup>
                      <label>Select File:</label>
                      <FileInput
                        type="file"
                        onChange={(e) => {
                          setUploadFile(e.target.files?.[0] || null);
                          setUploadError('');
                        }}
                        disabled={uploading}
                      />
                      {uploadFile && (
                        <FileName>📄 {uploadFile.name}</FileName>
                      )}
                    </FormGroup>

                    {uploadError && (
                      <ErrorMessage>{uploadError}</ErrorMessage>
                    )}

                    {uploading && (
                      <ProgressContainer>
                        <ProgressLabel>Uploading: {uploadProgress}%</ProgressLabel>
                        <ProgressBar>
                          <ProgressFill width={uploadProgress} />
                        </ProgressBar>
                      </ProgressContainer>
                    )}

                    <UploadButtonGroup>
                      <CancelBtn onClick={() => setShowUploadModal(false)} disabled={uploading}>
                        Cancel
                      </CancelBtn>
                      <SubmitBtn onClick={handleNewUpload} disabled={uploading || !uploadFile}>
                        {uploading ? 'Uploading...' : 'Upload to IPFS'}
                      </SubmitBtn>
                    </UploadButtonGroup>
                  </UploadForm>
                </UploadModalContent>
              </UploadModal>
            )}
          </DetailsPanel>
        ) : (
          <ListPanel>
            <h2>Active Cases</h2>
            {loading ? (
              <p>Loading FIR logs...</p>
            ) : firs.length === 0 ? (
              <p>No cases found</p>
            ) : (
              <CasesList>
                {firs.map((fir, idx) => (
                  <CaseItem key={idx} onClick={() => handleSelectFIR(fir)}>
                    <div className="case-header">
                      <h3>{fir.firId}</h3>
                      <StatusBadge $status={fir.caseStatus || 'open'}>
                        {(fir.caseStatus || 'open').toUpperCase()}
                      </StatusBadge>
                    </div>
                    <p className="timestamp">
                      Created: {new Date(fir.timestamp).toLocaleString()}
                    </p>
                    {fir.evidence && (
                      <p className="evidence-count">
                        📁 {fir.evidence.length} evidence file(s)
                      </p>
                    )}
                    <p className="click-hint">Click to view details →</p>
                  </CaseItem>
                ))}
              </CasesList>
            )}
          </ListPanel>
        )}
      </MainContainer>
    </>
  );
};

export default FIRLogs;

const NewUploadBtn = styled.button`
  padding: 0.6rem 1.2rem;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #45a049;
    transform: translateY(-2px);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const TabHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;

  h3 {
    margin: 0;
    color: #333;
    font-size: 1.3rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #667eea;
  }
`;

const UploadModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const UploadModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
`;

const UploadModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;

  h3 {
    margin: 0;
    color: #333;
    font-size: 1.5rem;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  transition: color 0.3s ease;

  &:hover {
    color: #333;
  }
`;

const UploadForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    color: #333;
    font-weight: 600;
  }
`;

const FileInput = styled.input`
  padding: 0.8rem;
  border: 2px dashed #667eea;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    border-color: #764ba2;
    background: #f9f7ff;
  }

  &:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }
`;

const FileName = styled.div`
  color: #4CAF50;
  font-weight: 600;
  padding: 0.5rem 0;
`;

const ErrorMessage = styled.div`
  background: #ffebee;
  color: #c62828;
  padding: 0.8rem;
  border-radius: 6px;
  border-left: 4px solid #c62828;
`;

const ProgressContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ProgressLabel = styled.div`
  color: #667eea;
  font-weight: 600;
  font-size: 0.9rem;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  width: ${props => props.width}%;
  transition: width 0.3s ease;
`;

const UploadButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
`;

const CancelBtn = styled.button`
  padding: 0.8rem 1.5rem;
  background: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background: #e0e0e0;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SubmitBtn = styled.button`
  padding: 0.8rem 1.5rem;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background: #45a049;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const MainContainer = styled.div`
  min-height: 100vh;
  width: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 0;
  margin: 0;

  .nav {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 40px;
    z-index: 1000;
  }

  .container {
    background: #111;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1em;
    padding: 0.5em 2em;
    border-radius: 40px;
    min-width: 600px;
  }

  .btn {
    position: relative;
    padding: 0.5em 1em;
    color: #fff;
    font-weight: bold;
    cursor: pointer;
    transition: 0.2s;
    white-space: nowrap;
  }

  .btn:hover {
    background: #e4ae0b;
    color: #000;
    border-radius: 10px;
  }

  .btn::after {
    content: "";
    position: absolute;
    bottom: -5px;
    left: 0;
    height: 3px;
    width: 0;
    background: #e4ae0b;
    transition: width 0.3s ease;
    border-radius: 2px;
  }

  .btn:hover::after {
    width: 100%;
  }
`;

const Header = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 3rem 2rem;
  padding-top: 8rem;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2.5rem;
  }

  p {
    margin: 0;
    font-size: 1.1rem;
    opacity: 0.9;
  }
`;

const ListPanel = styled.div`
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);

  h2 {
    margin-top: 0;
    color: #333;
  }
`;

const CasesList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
`;

const CaseItem = styled.div`
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

  &:hover {
    border-color: #667eea;
    box-shadow: 0 8px 16px rgba(102, 126, 234, 0.2);
    transform: translateY(-2px);
  }

  .case-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;

    h3 {
      margin: 0;
      color: #333;
      font-size: 1.3rem;
    }
  }

  .timestamp {
    color: #666;
    font-size: 0.9rem;
    margin: 0.5rem 0;
  }

  .evidence-count {
    color: #667eea;
    font-weight: 600;
    margin: 0.5rem 0;
  }

  .click-hint {
    color: #999;
    font-size: 0.9rem;
    margin: 1rem 0 0 0;
    font-style: italic;
  }
`;

const DetailsPanel = styled.div`
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
`;

const BackButton = styled.button`
  background: #f0f0f0;
  border: 1px solid #ddd;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.3s ease;
  margin-bottom: 1.5rem;

  &:hover {
    background: #667eea;
    color: white;
    border-color: #667eea;
  }
`;

const CaseHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #e0e0e0;

  h2 {
    margin: 0 0 0.5rem 0;
    color: #333;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
  }
`;

const CaseMetadata = styled.div`
  p {
    margin: 0.3rem 0;
    color: #666;
    font-size: 0.95rem;
  }

  strong {
    color: #333;
  }
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  background: ${props => {
    switch(props.$status) {
      case 'open': return '#e3f2fd';
      case 'in-progress': return '#fff3e0';
      case 'under-evaluation': return '#f3e5f5';
      case 'concluded': return '#e8f5e9';
      default: return '#f5f5f5';
    }
  }};
  color: ${props => {
    switch(props.$status) {
      case 'open': return '#1976d2';
      case 'in-progress': return '#f57c00';
      case 'under-evaluation': return '#7b1fa2';
      case 'concluded': return '#388e3c';
      default: return '#333';
    }
  }};
`;

const TabsContainer = styled.div`
  margin-top: 2rem;
`;

const Tab = styled.div`
  margin-bottom: 2rem;

  h3 {
    color: #333;
    font-size: 1.3rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #667eea;
  }
`;

const EvidenceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const EvidenceCard = styled.div`
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;

  &:hover {
    border-color: #667eea;
    background: #f5f7ff;
  }

  .view-button {
    padding: 0.6rem 1.2rem;
    background: #4CAF50;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    transition: all 0.3s ease;
    white-space: nowrap;
    margin-left: 1rem;

    &:hover {
      background: #45a049;
    }
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;

    .view-button {
      margin-left: 0;
      margin-top: 1rem;
    }
  }
`;

const EvidenceInfo = styled.div`
  display: flex;
  gap: 1rem;
  flex: 1;

  p {
    margin: 0.3rem 0;
    color: #666;
    font-size: 0.95rem;
  }

  strong {
    color: #333;
  }

  .hash {
    font-family: 'Courier New', monospace;
    color: #0066cc;
    font-size: 0.85rem;
  }

  .timestamp {
    font-size: 0.85rem;
    color: #999;
  }

  .description {
    color: #666;
    font-style: italic;
  }
`;

const EvidenceType = styled.span`
  display: inline-block;
  background: #667eea;
  color: white;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
`;

const StatusUpdateForm = styled.div`
  background: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid #667eea;
`;

const UpdateButton = styled.button`
  width: 100%;
  padding: 0.8rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background: #764ba2;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const Timeline = styled.div`
  position: relative;
  padding: 1rem 0 1rem 3rem;

  &::before {
    content: '';
    position: absolute;
    left: 0.5rem;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  }
`;

const TimelineEntry = styled.div`
  position: relative;
  margin-bottom: 2rem;

  &::before {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    background: white;
    border: 3px solid #667eea;
    border-radius: 50%;
    left: -2.5rem;
    top: 0.2rem;
  }
`;

const TimelineMarker = styled.div`
  width: 12px;
  height: 12px;
  background: ${props => {
    switch(props.$status) {
      case 'open': return '#1976d2';
      case 'in-progress': return '#f57c00';
      case 'under-evaluation': return '#7b1fa2';
      case 'concluded': return '#388e3c';
      default: return '#667eea';
    }
  }};
  border-radius: 50%;
  position: absolute;
  left: -2.3rem;
  top: 0.3rem;
`;

const TimelineContent = styled.div`
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 6px;
  border-left: 3px solid #667eea;
`;

const TimelineStatus = styled.div`
  display: inline-block;
  background: ${props => {
    switch(props.$status) {
      case 'open': return '#e3f2fd';
      case 'in-progress': return '#fff3e0';
      case 'under-evaluation': return '#f3e5f5';
      case 'concluded': return '#e8f5e9';
      default: return '#f5f5f5';
    }
  }};
  color: ${props => {
    switch(props.$status) {
      case 'open': return '#1976d2';
      case 'in-progress': return '#f57c00';
      case 'under-evaluation': return '#7b1fa2';
      case 'concluded': return '#388e3c';
      default: return '#333';
    }
  }};
  padding: 0.3rem 0.8rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
`;

const TimelineTime = styled.div`
  color: #999;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
`;

const TimelineNote = styled.div`
  color: #333;
  margin-bottom: 0.5rem;
`;

const TimelineEvidenceCount = styled.div`
  color: #667eea;
  font-weight: 600;
  font-size: 0.9rem;
  margin-top: 0.5rem;
`;