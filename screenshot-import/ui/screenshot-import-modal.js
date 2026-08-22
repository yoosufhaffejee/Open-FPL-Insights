/**
 * Open-FPL-Insights Screenshot Importer UI
 */

let screenshotImporterInstance = null;
let importedPlayersList = [];

function openScreenshotImportModal() {
    const modalHtml = `
    <div class="modal fade" id="screenshotImportModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Import Team from Screenshot</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body text-center" id="screenshot-modal-body">
                    <div id="upload-stage">
                        <p>Upload a screenshot of your FPL pitch view to automatically import your team.</p>
                        <input type="file" id="screenshot-upload-input" accept="image/png, image/jpeg, image/webp" class="form-control mb-3" />
                        <button class="btn btn-primary" id="btn-start-import">Scan Team</button>
                    </div>
                    <div id="progress-stage" style="display: none;">
                        <h5 id="progress-message">Preparing...</h5>
                        <div class="progress mb-3">
                            <div class="progress-bar progress-bar-striped progress-bar-animated bg-success" id="import-progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                        </div>
                        <button class="btn btn-danger btn-sm" id="btn-cancel-import">Cancel</button>
                    </div>
                    <div id="review-stage" style="display: none;">
                        <h5>Review Your Team</h5>
                        <p class="text-muted text-sm">We couldn't be 100% sure about some players. Please review the highlighted ones.</p>
                        <div id="review-list" class="text-start" style="max-height: 400px; overflow-y: auto;"></div>
                    </div>
                    <div id="error-stage" style="display: none;">
                        <div class="alert alert-danger" id="import-error-msg"></div>
                        <button class="btn btn-secondary" id="btn-retry-import">Try Again</button>
                    </div>
                </div>
                <div class="modal-footer" id="screenshot-modal-footer" style="display: none;">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-success" id="btn-confirm-import">Import Team</button>
                </div>
            </div>
        </div>
    </div>
    `;

    let modalContainer = document.getElementById('screenshot-import-modal-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'screenshot-import-modal-container';
        document.body.appendChild(modalContainer);
    }
    modalContainer.innerHTML = modalHtml;

    const modal = new bootstrap.Modal(document.getElementById('screenshotImportModal'));
    
    document.getElementById('btn-start-import').addEventListener('click', startImport);
    document.getElementById('btn-cancel-import').addEventListener('click', cancelImport);
    document.getElementById('btn-retry-import').addEventListener('click', resetModalState);
    document.getElementById('btn-confirm-import').addEventListener('click', confirmImport);
    
    document.getElementById('screenshotImportModal').addEventListener('hidden.bs.modal', function () {
        cancelImport();
    });

    modal.show();
}

function resetModalState() {
    document.getElementById('upload-stage').style.display = 'block';
    document.getElementById('progress-stage').style.display = 'none';
    document.getElementById('review-stage').style.display = 'none';
    document.getElementById('error-stage').style.display = 'none';
    document.getElementById('screenshot-modal-footer').style.display = 'none';
    document.getElementById('screenshot-upload-input').value = '';
}

function startImport() {
    const fileInput = document.getElementById('screenshot-upload-input');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert("Please select a screenshot file first.");
        return;
    }
    const file = fileInput.files[0];
    
    // Switch UI
    document.getElementById('upload-stage').style.display = 'none';
    document.getElementById('progress-stage').style.display = 'block';
    
    if (!screenshotImporterInstance) {
        screenshotImporterInstance = new ScreenshotImporter(allPlayers, teams);
    }
    
    screenshotImporterInstance.onProgress = (data) => {
        document.getElementById('progress-message').innerText = data.message;
        const pbar = document.getElementById('import-progress-bar');
        pbar.style.width = data.progress + '%';
        pbar.innerText = data.progress + '%';
        pbar.setAttribute('aria-valuenow', data.progress);
    };
    
    screenshotImporterInstance.onComplete = (results) => {
        showReviewStage(results);
    };
    
    screenshotImporterInstance.onError = (err) => {
        showErrorStage(err.message);
    };
    
    screenshotImporterInstance.processImage(file);
}

function cancelImport() {
    if (screenshotImporterInstance) {
        screenshotImporterInstance.cancel();
    }
    resetModalState();
}

function showErrorStage(msg) {
    document.getElementById('progress-stage').style.display = 'none';
    document.getElementById('error-stage').style.display = 'block';
    document.getElementById('import-error-msg').innerText = msg;
}

function showReviewStage(results) {
    document.getElementById('progress-stage').style.display = 'none';
    document.getElementById('review-stage').style.display = 'block';
    document.getElementById('screenshot-modal-footer').style.display = 'flex';
    
    importedPlayersList = results;
    renderReviewList();
}

function renderReviewList() {
    const listContainer = document.getElementById('review-list');
    listContainer.innerHTML = '<ul class="list-group"></ul>';
    const ul = listContainer.querySelector('ul');
    
    importedPlayersList.forEach((result, idx) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        
        let statusHtml = '';
        let rowHtml = `<span class="badge bg-secondary me-2">${result.rowName}</span>`;
        
        if (result.match.status === 'automatic') {
            li.classList.add('list-group-item-success');
            statusHtml = '<span><i class="fas fa-check text-success"></i> ' + result.match.finalCandidate.playerName + '</span>';
        } else {
            li.classList.add('list-group-item-warning');
            
            let alternativesHtml = result.match.alternatives.map(alt => `<option value="${alt.playerId}">${alt.playerName}</option>`).join('');
            
            statusHtml = `
                <div>
                    <div class="mb-1"><i class="fas fa-exclamation-triangle text-warning"></i> Uncertain (OCR: "${result.rawText}")</div>
                    <select class="form-select form-select-sm player-correction-select" data-idx="${idx}">
                        <option value="${result.match.finalCandidate.playerId}" selected>${result.match.finalCandidate.playerName} (Suggested)</option>
                        ${alternativesHtml}
                        <option value="ignore">-- Ignore this --</option>
                    </select>
                </div>
            `;
        }
        
        li.innerHTML = `<div>${rowHtml} ${statusHtml}</div>`;
        ul.appendChild(li);
    });
    
    document.querySelectorAll('.player-correction-select').forEach(select => {
        select.addEventListener('change', function(e) {
            const index = this.getAttribute('data-idx');
            const val = this.value;
            if (val === 'ignore') {
                importedPlayersList[index].ignore = true;
            } else {
                importedPlayersList[index].ignore = false;
                importedPlayersList[index].match.finalCandidate = importedPlayersList[index].match.alternatives.find(a => a.playerId == val) || importedPlayersList[index].match.finalCandidate; // Need to fix this lookup ideally, but sticking to existing alt list works for now
            }
        });
    });
}

function confirmImport() {
    const finalIds = importedPlayersList
        .filter(r => !r.ignore)
        .map(r => r.match.finalCandidate.playerId);
        
    if (finalIds.length === 0) {
        alert("No valid players selected to import.");
        return;
    }
    
    // Simulate team picks for the app's existing logic
    const picks = finalIds.map((id, index) => {
        return {
            element: id,
            is_captain: false,
            is_vice_captain: false
        };
    });
    
    // Call existing addPlayers logic
    addPlayers(picks);
    
    bootstrap.Modal.getInstance(document.getElementById('screenshotImportModal')).hide();
}
