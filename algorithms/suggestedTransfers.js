function calculateSuggestedTransfers(currentTeamIds, allPlayers, fixtures, currentGW, bankBalance) {
    const HORIZON = 5; 
    const currentTeam = allPlayers.filter(p => currentTeamIds.includes(p.id));
    
    const playerXP = new Map();
    allPlayers.forEach(p => {
        let xp = 0;
        for (let i = 0; i < HORIZON; i++) {
            let gw = currentGW + i;
            let fixture = fixtures.find(f => f.event === gw && (f.team_a === p.team || f.team_h === p.team));
            let pts = typeof window.calculatePlayerPredictedPoints === 'function' 
                ? window.calculatePlayerPredictedPoints(p, fixture, gw) 
                : '?';
            if (pts !== '?') xp += parseFloat(pts);
        }
        playerXP.set(p.id, xp);
    });

    let suggestions = [];
    const availablePlayers = allPlayers.filter(p => !currentTeamIds.includes(p.id));
    
    // Helper to get top N players of a specific position to reduce combinatorial explosion
    const getTopAvail = (type, n = 30) => availablePlayers
        .filter(p => p.element_type === type)
        .sort((a, b) => playerXP.get(b.id) - playerXP.get(a.id))
        .slice(0, n);

    // 1 TRANSFER COMBOS
    for (let i = 0; i < currentTeam.length; i++) {
        let pOut = currentTeam[i];
        let outXp = playerXP.get(pOut.id);
        let candidates = availablePlayers.filter(p => p.element_type === pOut.element_type);
        
        for (let pIn of candidates) {
            let availableBudget = bankBalance + (pOut.now_cost / 10);
            if ((pIn.now_cost / 10) > availableBudget + 0.5) continue;
            
            let inXp = playerXP.get(pIn.id);
            let xpDiff = inXp - outXp;
            
            if (xpDiff > 0.5) { 
                suggestions.push({
                    type: 1, outs: [pOut], ins: [pIn], xpDiff, 
                    costDiff: ((pOut.now_cost - pIn.now_cost) / 10), outXp, inXp
                });
            }
        }
    }

    // 2 TRANSFER COMBOS (-4 Hit)
    for (let i = 0; i < currentTeam.length; i++) {
        for (let j = i + 1; j < currentTeam.length; j++) {
            let outs = [currentTeam[i], currentTeam[j]];
            let outXp = outs.reduce((sum, p) => sum + playerXP.get(p.id), 0);
            let availableBudget = bankBalance + outs.reduce((sum, p) => sum + (p.now_cost / 10), 0);
            
            let avail1 = getTopAvail(outs[0].element_type, 40);
            let avail2 = getTopAvail(outs[1].element_type, 40);
            
            for (let x = 0; x < avail1.length; x++) {
                let startY = (outs[0].element_type === outs[1].element_type) ? x + 1 : 0;
                for (let y = startY; y < avail2.length; y++) {
                    let ins = [avail1[x], avail2[y]];
                    if (ins[0].id === ins[1].id) continue;
                    
                    if (ins.reduce((sum, p) => sum + (p.now_cost / 10), 0) > availableBudget + 0.5) continue;
                    
                    let inXp = ins.reduce((sum, p) => sum + playerXP.get(p.id), 0);
                    let xpDiff = inXp - outXp - 4; 
                    
                    if (xpDiff > 1.0) {
                        suggestions.push({
                            type: 2, outs, ins, xpDiff, 
                            costDiff: outs.reduce((sum, p) => sum + p.now_cost, 0)/10 - ins.reduce((sum, p) => sum + p.now_cost, 0)/10, 
                            outXp, inXp
                        });
                    }
                }
            }
        }
    }
    
    // 3 TRANSFER COMBOS (-8 Hit)
    for (let i = 0; i < currentTeam.length; i++) {
        for (let j = i + 1; j < currentTeam.length; j++) {
            for (let k = j + 1; k < currentTeam.length; k++) {
                let outs = [currentTeam[i], currentTeam[j], currentTeam[k]];
                let outXp = outs.reduce((sum, p) => sum + playerXP.get(p.id), 0);
                let availableBudget = bankBalance + outs.reduce((sum, p) => sum + (p.now_cost / 10), 0);
                
                let avail1 = getTopAvail(outs[0].element_type, 20);
                let avail2 = getTopAvail(outs[1].element_type, 20);
                let avail3 = getTopAvail(outs[2].element_type, 20);
                
                for (let x = 0; x < avail1.length; x++) {
                    let startY = (outs[0].element_type === outs[1].element_type) ? x + 1 : 0;
                    for (let y = startY; y < avail2.length; y++) {
                        let startZ = (outs[1].element_type === outs[2].element_type) ? y + 1 : 
                                     (outs[0].element_type === outs[2].element_type ? x + 1 : 0);
                                     
                        for (let z = startZ; z < avail3.length; z++) {
                            let ins = [avail1[x], avail2[y], avail3[z]];
                            if (ins[0].id === ins[1].id || ins[0].id === ins[2].id || ins[1].id === ins[2].id) continue;
                            
                            if (ins.reduce((sum, p) => sum + (p.now_cost / 10), 0) > availableBudget + 0.5) continue;
                            
                            let inXp = ins.reduce((sum, p) => sum + playerXP.get(p.id), 0);
                            let xpDiff = inXp - outXp - 8; 
                            
                            if (xpDiff > 2.0) {
                                suggestions.push({
                                    type: 3, outs, ins, xpDiff, 
                                    costDiff: outs.reduce((sum, p) => sum + p.now_cost, 0)/10 - ins.reduce((sum, p) => sum + p.now_cost, 0)/10, 
                                    outXp, inXp
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    suggestions.sort((a, b) => b.xpDiff - a.xpDiff);
    
    // Ensure variety: top 3 singles, top 4 doubles, top 3 triples
    let singles = suggestions.filter(s => s.type === 1).slice(0, 3);
    let doubles = suggestions.filter(s => s.type === 2).slice(0, 4);
    let triples = suggestions.filter(s => s.type === 3).slice(0, 3);
    
    let mixed = [...singles, ...doubles, ...triples].sort((a, b) => b.xpDiff - a.xpDiff);
    
    return mixed;
}
