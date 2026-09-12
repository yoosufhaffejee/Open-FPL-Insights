const fs = require('fs');
let content = fs.readFileSync('helpers/helpers.js', 'utf8');

const regex = /\/\/ Function to analyze player stats for anomalies \(lucky\/unlucky\)[\s\S]*?return null;\r?\n\}/;
const newFunc = `// Function to get player insights (anomalies + recent form)
function getPlayerInsights(player, fixturesList) {
    if (!fixturesList || !player) return null;
    let insights = [];
    
    let mins = parseInt(player.minutes) || 0;
    if (mins > 180) {
        let xG = parseFloat(player.expected_goals) || 0;
        let xA = parseFloat(player.expected_assists) || 0;
        let xGC = parseFloat(player.expected_goals_conceded) || 0;
        
        let goals = parseInt(player.goals_scored) || 0;
        let assists = parseInt(player.assists) || 0;
        let gc = parseInt(player.goals_conceded) || 0;

        let isDef = player.element_type === 1 || player.element_type === 2;

        if (isDef) {
            if (xGC - gc > 2.5) {
                insights.push({ priority: 2, icon: '!', colorClass: 'badge-lucky', text: \`Lucky Defense: Expected to concede \${xGC.toFixed(1)} goals but only conceded \${gc}.\` });
            } else if (gc - xGC > 2.5) {
                insights.push({ priority: 2, icon: '!', colorClass: 'badge-unlucky', text: \`Unlucky Defense: Conceded \${gc} goals but only expected to concede \${xGC.toFixed(1)}.\` });
            }
        } else {
            if (xG - goals > 1.5) {
                insights.push({ priority: 2, icon: '!', colorClass: 'badge-unlucky', text: \`Unlucky Finisher: Expected \${xG.toFixed(1)} goals but only scored \${goals}.\` });
            } else if (goals - xG > 1.5) {
                insights.push({ priority: 2, icon: '!', colorClass: 'badge-lucky', text: \`Lucky Finisher: Scored \${goals} goals from only \${xG.toFixed(1)} expected.\` });
            }
            if (xA - assists > 1.5) {
                insights.push({ priority: 2, icon: '!', colorClass: 'badge-unlucky', text: \`Unlucky Playmaker: Expected \${xA.toFixed(1)} assists but only got \${assists}.\` });
            } else if (assists - xA > 1.5) {
                insights.push({ priority: 2, icon: '!', colorClass: 'badge-lucky', text: \`Lucky Playmaker: Got \${assists} assists from only \${xA.toFixed(1)} expected.\` });
            }
        }
    }

    let teamFixtures = fixturesList.filter(f => f.finished && (f.team_h === player.team || f.team_a === player.team));
    teamFixtures.sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));
    let recentFixtures = teamFixtures.slice(0, 4);

    if (recentFixtures.length > 0) {
        let recentGoals = 0, recentAssists = 0, bonusGames = 0, recentCards = 0, teamConceded = 0, cleanSheets = 0;

        recentFixtures.forEach(f => {
            let concededInThisMatch = (f.team_h === player.team) ? f.team_a_score : f.team_h_score;
            teamConceded += concededInThisMatch;
            if (concededInThisMatch === 0) cleanSheets++;

            if (f.stats) {
                let getStat = (identifier) => {
                    let statObj = f.stats.find(s => s.identifier === identifier);
                    if (!statObj) return 0;
                    let arr = (f.team_h === player.team) ? statObj.h : statObj.a;
                    let pStat = arr.find(s => s.element === player.id);
                    return pStat ? pStat.value : 0;
                };

                recentGoals += getStat('goals_scored');
                recentAssists += getStat('assists');
                if (getStat('bonus') > 0) bonusGames++;
                recentCards += getStat('yellow_cards') + getStat('red_cards');
            }
        });

        if (recentGoals >= 3) insights.push({ priority: 1, icon: '??', colorClass: 'badge-fire', text: \`On Fire: Scored \${recentGoals} goals in the last \${recentFixtures.length} matches.\` });
        if (recentAssists >= 3) insights.push({ priority: 4, icon: '??', colorClass: 'badge-blue', text: \`Playmaker: Provided \${recentAssists} assists in the last \${recentFixtures.length} matches.\` });
        if (bonusGames >= 3) insights.push({ priority: 5, icon: '?', colorClass: 'badge-blue', text: \`Bonus Magnet: Earned bonus points in \${bonusGames} of the last \${recentFixtures.length} matches.\` });
        if (recentCards >= 2) insights.push({ priority: 6, icon: '??', colorClass: 'badge-lucky', text: \`Discipline: Received \${recentCards} cards in the last \${recentFixtures.length} matches.\` });

        let isDef = player.element_type === 1 || player.element_type === 2;
        if (isDef) {
            if (cleanSheets >= 2) insights.push({ priority: 3, icon: '???', colorClass: 'badge-blue', text: \`Solid Defense: Kept \${cleanSheets} clean sheets in last \${recentFixtures.length} matches.\` });
            if (teamConceded >= 8) insights.push({ priority: 3, icon: '??', colorClass: 'badge-lucky', text: \`Leaky Defense: Conceded \${teamConceded} goals in last \${recentFixtures.length} matches.\` });
        }
    }

    if (insights.length === 0) return null;
    insights.sort((a, b) => a.priority - b.priority);
    return insights;
}`;

content = content.replace(regex, newFunc);
fs.writeFileSync('helpers/helpers.js', content, 'utf8');
