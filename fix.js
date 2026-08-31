const fs = require('fs');
let html = fs.readFileSync('script.js', 'utf8');

const oldFn = /\/\/ ======== SUGGESTED TRANSFERS LOGIC ========\nfunction openSuggestedTransfersModal\(\)[\s\S]*?function updateActionButtonsVisibility/;

const newFn = `// ======== SUGGESTED TRANSFERS LOGIC ========
function applyTransfer(suggestion) {
    // Close modal
    const modalEl = document.getElementById('suggestedTransfersModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // Remove outs and add ins
    suggestion.outs.forEach(pOut => {
        const idx = myPlayers.findIndex(p => p.id === pOut.id);
        if (idx !== -1) {
            const positionPrefix = pitchPositionMap[myPlayers[idx].element_type];
            filledSlots[positionPrefix]--;
            myPlayers.splice(idx, 1);
        }
    });

    suggestion.ins.forEach(pIn => {
        addPlayer(pIn);
    });

    document.getElementById('saveButton').style.display = 'inline-block';
    updateTeamUI();
}

function openSuggestedTransfersModal() {
    const modalContent = document.getElementById('suggestedTransfersContent');
    modalContent.innerHTML = \`
        <div class="text-center py-4">
            <div class="spinner-border text-success mb-3" role="status" style="width: 2.5rem; height: 2.5rem;"></div>
            <p class="text-muted mb-0">Analysing your squad over the next 5 gameweeks...</p>
        </div>
    \`;

    const modal = new bootstrap.Modal(document.getElementById('suggestedTransfersModal'));
    modal.show();

    setTimeout(() => {
        try {
            let currentTeamIds = myPlayers.map(p => p.id);
            if (currentTeamIds.length === 0) {
                modalContent.innerHTML = '<p class="text-warning p-3">Please add players to your team first.</p>';
                return;
            }

            let suggestions = calculateSuggestedTransfers(currentTeamIds, allPlayers, fixtures, selectedGameweek, bankBalance);

            if (suggestions.length === 0) {
                modalContent.innerHTML = \`
                    <div class="text-center py-5">
                        <i class="fas fa-check-circle text-success mb-3" style="font-size: 3rem;"></i>
                        <h5 class="text-white mb-2">Hold Your Transfers</h5>
                        <p class="text-muted">No transfers are currently worth making. Roll your free transfer — your squad looks strong for the next 5 gameweeks.</p>
                    </div>
                \`;
                return;
            }

            const positionLabels = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

            let html = \`<div class="transfer-list d-flex flex-column gap-3 pb-2">\`;

            suggestions.forEach((s, idx) => {
                const isHit = s.type > 1;
                const hitPoints = (s.type - 1) * 4;
                const typeLabel = s.type === 1 ? 'Free Transfer' : s.type === 2 ? '2 Transfers' : '3 Transfers';
                const typeBadgeCls = s.type === 1 ? 'bg-success' : s.type === 2 ? 'bg-warning text-dark' : 'bg-danger';
                const costDiff = s.costDiff;
                const costStr = (costDiff >= 0 ? '+' : '') + '£' + costDiff.toFixed(1) + 'm';
                const costCls = costDiff >= 0 ? 'text-success' : 'text-danger';

                const renderPlayer = (p, isSell) => {
                    const img = \`https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_\${p.team_code}-110.webp\`;
                    const pos = positionLabels[p.element_type] || '';
                    const priceCls = isSell ? 'text-danger' : 'text-success';
                    return \`
                        <div class="transfer-player text-center">
                            <img src="\${img}" width="44" height="auto" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp'" alt="">
                            <div class="mt-1 fw-semibold text-white" style="font-size:0.82rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80px;">\${p.web_name}</div>
                            <div class="text-muted" style="font-size:0.72rem;">\${pos}</div>
                            <div class="\${priceCls} fw-bold" style="font-size:0.78rem;">£\${(p.now_cost / 10).toFixed(1)}m</div>
                        </div>
                    \`;
                };

                const sellPlayers = s.outs.map(p => renderPlayer(p, true)).join('');
                const buyPlayers = s.ins.map(p => renderPlayer(p, false)).join('');

                html += \`
                    <div class="transfer-card border border-secondary rounded-3 p-3" style="background: #1a1a1a;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="badge \${typeBadgeCls} px-2 py-1" style="font-size:0.75rem;">\${typeLabel}</span>
                            \${isHit ? \`<span class="badge bg-danger bg-opacity-25 text-danger border border-danger px-2 py-1" style="font-size:0.72rem;">⚠ -\${hitPoints} point hit</span>\` : '<span class="badge bg-success bg-opacity-25 text-success border border-success px-2 py-1" style="font-size:0.72rem;">✓ No hit</span>'}
                            <span class="fw-bold text-success" style="font-size:1rem;">+\${s.xpDiff.toFixed(1)} <span class="text-muted fw-normal" style="font-size:0.75rem;">xP</span></span>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <div class="transfer-section d-flex gap-2 justify-content-end flex-wrap" style="flex:1;">
                                \${sellPlayers}
                            </div>
                            <div class="transfer-arrow text-muted px-2" style="font-size:1.4rem;">→</div>
                            <div class="transfer-section d-flex gap-2 justify-content-start flex-wrap" style="flex:1;">
                                \${buyPlayers}
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-secondary">
                            <div class="d-flex gap-3 text-muted" style="font-size:0.78rem;">
                                <span>Out xP: <strong class="text-white">\${s.outXp.toFixed(1)}</strong></span>
                                <span>In xP: <strong class="text-success">\${s.inXp.toFixed(1)}</strong></span>
                                <span>Cost: <strong class="\${costCls}">\${costStr}</strong></span>
                            </div>
                            <button class="btn btn-sm btn-outline-success" onclick='applyTransfer(\${JSON.stringify({
                                type: s.type,
                                outs: s.outs.map(p => ({ id: p.id, element_type: p.element_type, web_name: p.web_name })),
                                ins: s.ins.map(p => p.id)
                            })})' style="font-size:0.78rem; padding: 4px 12px;">
                                Apply Transfer
                            </button>
                        </div>
                    </div>
                \`;
            });

            html += \`</div>\`;
            modalContent.innerHTML = html;

        } catch(e) {
            console.error(e);
            modalContent.innerHTML = '<p class="text-danger p-3">Error calculating transfers. Please try recalculating predictions first.</p>';
        }
    }, 100);
}

// ======== BUTTON VISIBILITY LOGIC ========
function updateActionButtonsVisibility`;

html = html.replace(oldFn, newFn);
fs.writeFileSync('script.js', html);
