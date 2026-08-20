import os
import pandas as pd
import glob

def main():
    repo_data_dir = r"C:\Users\Yoosuf\Documents\Fantasy-Premier-League\data"
    output_csv = r"C:\Users\Yoosuf\Documents\Open-FPL-Insights\fpl_data.csv"
    
    master_csv_path = os.path.join(repo_data_dir, "cleaned_merged_seasons.csv")
    
    if not os.path.exists(master_csv_path):
        print(f"Error: Could not find {master_csv_path}")
        return
        
    print(f"Loading base data from {master_csv_path}...")
    df_master = pd.read_csv(master_csv_path, low_memory=False)
    
    # We only process seasons > 2023-24 that aren't already in the master dataset
    processed_seasons = set(df_master['season_x'].unique())
    print(f"Seasons already in base data: {sorted(list(processed_seasons))}")
    
    new_dfs = []
    
    # Find all season folders (e.g. 2024-25, 2025-26, etc)
    for season_folder in sorted(os.listdir(repo_data_dir)):
        # Check if folder name matches pattern "YYYY-YY"
        if not (season_folder.startswith("20") and len(season_folder) == 7 and "-" in season_folder):
            continue
            
        if season_folder in processed_seasons:
            continue
            
        merged_gw_path = os.path.join(repo_data_dir, season_folder, "gws", "merged_gw.csv")
        teams_path = os.path.join(repo_data_dir, season_folder, "teams.csv")
        
        if not os.path.exists(merged_gw_path):
            print(f"Skipping {season_folder} (missing gws/merged_gw.csv)")
            continue
            
        if not os.path.exists(teams_path):
            print(f"Skipping {season_folder} (missing teams.csv)")
            continue
            
        print(f"Processing new season: {season_folder}...")
        df_gw = pd.read_csv(merged_gw_path, low_memory=False)
        df_teams = pd.read_csv(teams_path)
        
        # Create a dictionary to map team 'id' to team 'name'
        team_mapping = dict(zip(df_teams['id'], df_teams['name']))
        
        # Add the 'opp_team_name' column using the mapping
        df_gw['opp_team_name'] = df_gw['opponent_team'].map(team_mapping)
        
        # Add the 'season_x' column
        df_gw['season_x'] = season_folder
        
        # Rename 'team' column to 'team_x' to match the master CSV format
        if 'team' in df_gw.columns:
            df_gw.rename(columns={'team': 'team_x'}, inplace=True)
            
        # Optional: Some minor cleanup on player names if needed, but Vaastav's raw data 
        # is usually mostly clean for the newer seasons.
            
        new_dfs.append(df_gw)
        
    if new_dfs:
        print("Concatenating new seasons with base data...")
        df_combined = pd.concat([df_master] + new_dfs, ignore_index=True, sort=False)
        
        print(f"Saving updated data to {output_csv}...")
        df_combined.to_csv(output_csv, index=False)
        print("Successfully updated fpl_data.csv!")
    else:
        print("No new seasons with data found to add.")
        print(f"To ensure latest data, make sure you do a 'git pull' inside {repo_data_dir}")

if __name__ == "__main__":
    main()
