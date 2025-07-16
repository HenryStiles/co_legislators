"""
Colorado Legislator Data Fetcher

This script fetches current legislator information from the Colorado Legislature website
and outputs it as structured JSON data. It includes district information, party affiliation,
committee assignments, and counties served for each legislator.

Author: Your Name
Version: 1.0
Dependencies: requests, beautifulsoup4, pandas
"""

import requests
from bs4 import BeautifulSoup, Tag
import pandas as pd # Using pandas for easy table creation and display
import json
import time

def fetch_legislator_data(url):
    """
    Fetches legislator data (district, chamber, link) from the provided URL.

    This function scrapes the Colorado Legislature website to extract comprehensive
    information about each legislator including their district, chamber, name,
    party affiliation, personal website link, committee assignments, and counties served.

    Args:
        url (str): The URL of the webpage to fetch (Colorado Legislature legislators page)

    Returns:
        list of dict: Each dict contains legislator info with keys:
            - District: District number (str)
            - Chamber: "Senate" or "House" (str)
            - Name: Legislator's full name (str)
            - Party: Political party (str)
            - Link: Personal legislator page URL (str)
            - Committees: List of dicts with 'name' and 'role' keys
            - Counties: List of county names served (list of str)

    Raises:
        requests.exceptions.RequestException: If the HTTP request fails
        Exception: For other unexpected errors during scraping
    """
    legislators_data = []
    base_url = "https://leg.colorado.gov" # Base URL for constructing absolute links

    try:
        # Fetch the main legislators page
        response = requests.get(url)
        response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        soup = BeautifulSoup(response.text, 'html.parser')

        # Find the table by its ID
        legislators_table = soup.find('table', id='legislators-overview-table')

        if not legislators_table:
            print("Error: Legislators table not found with ID 'legislators-overview-table'.")
            return []

        # Find all table rows within the tbody (excluding the header row)
        tbody = legislators_table.find('tbody')
        if tbody and isinstance(tbody, Tag):
            table_rows = tbody.find_all('tr')
        else:
            table_rows = []

        # Process each legislator row
        for row in table_rows:
            cells = row.find_all('td')
            if len(cells) >= 4: # Ensure there are enough columns
                # Extract chamber information
                chamber_text = cells[0].get_text(strip=True)
                chamber = "Senate" if "Senator" in chamber_text else "House"

                # Extract name and link from the second column
                name_elem = cells[1].find('a')
                name = name_elem.get_text(strip=True) if name_elem else "N/A"

                # Construct full URL for legislator's personal page
                legislator_link = "N/A"
                if name_elem and 'href' in name_elem.attrs:
                    relative_link = name_elem['href']
                    if not relative_link.startswith('http'):
                        legislator_link = base_url + relative_link
                    else:
                        legislator_link = relative_link

                # Extract district number from the third column
                district_elem = cells[2].find('div', class_='field-content')
                district = district_elem.get_text(strip=True) if district_elem else "N/A"

                # Extract party affiliation from the fourth column
                party_elem = cells[3].find('div', class_='field-content')
                party = party_elem.get_text(strip=True) if party_elem else "N/A"

                # --- Fetch detail page for committees and counties ---
                committees = []
                counties = []
                if legislator_link != "N/A":
                    try:
                        # Fetch the individual legislator's detail page
                        detail_resp = requests.get(legislator_link)
                        detail_resp.raise_for_status()
                        detail_soup = BeautifulSoup(detail_resp.text, 'html.parser')
                        
                        # Extract committee assignments
                        for cblock in detail_soup.select('.committee-assignment'):
                            cname_elem = cblock.select_one('.committee-link a')
                            role_elem = cblock.select_one('.committee-role span')
                            cname = cname_elem.get_text(strip=True) if cname_elem else ""
                            role = role_elem.get_text(strip=True) if role_elem else ""
                            if cname:
                                committees.append({"name": cname, "role": role})
                        
                        # Extract counties served
                        for county_elem in detail_soup.select('.field-name-field-counties .field-item'):
                            county = county_elem.get_text(strip=True)
                            if county:
                                counties.append(county)
                        
                        # Be polite to the server with rate limiting
                        time.sleep(0.2)
                    except Exception as e:
                        print(f"Error fetching details for {name}: {e}")

                # Add this legislator's data to our collection
                legislators_data.append({
                    "District": district,
                    "Chamber": chamber,
                    "Name": name,
                    "Party": party,
                    "Link": legislator_link,
                    "Committees": committees,
                    "Counties": counties
                })
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from {url}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    return legislators_data

# Main execution block
if __name__ == "__main__":
    # URL of the webpage to fetch
    target_url = "https://leg.colorado.gov/legislators"

    print("Fetching legislator data from Colorado Legislature website...")
    
    # Fetch the live webpage content
    fetched_data = fetch_legislator_data(target_url)

    if fetched_data:
        print(f"Successfully fetched data for {len(fetched_data)} legislators")
        
        # Convert to Pandas DataFrame for easy table creation and display
        df = pd.DataFrame(fetched_data)

        # Print the Markdown table for verification
        print("\nLegislator Summary:")
        print(df.to_markdown(index=False))

        # Write the data to an external file as a json table that can be
        # read by a web application.
        df.to_json('legislators.json', orient='records')
        print(f"\nData saved to legislators.json")

        # Read the data from the file and print it for verification
        with open('legislators.json', 'r') as file:
            data = json.load(file)
        print(f"Verified: {len(data)} records written to file")
    else:
        print("No data was fetched. Please check the website and try again.")


