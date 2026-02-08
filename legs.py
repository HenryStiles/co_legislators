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
import os
import re

def sanitize_filename(name):
    """Sanitize a string to be a safe filename."""
    # Remove special characters and replace spaces with underscores
    return re.sub(r'[^\w\s-]', '', name).strip().replace(' ', '_').lower()

def download_image(url, name):
    """Download an image from a URL and save it locally."""
    if not url or url == "N/A":
        return "N/A"
    
    try:
        # Create sanitized filename
        filename = sanitize_filename(name)
        
        # Extract extension from URL or default to .jpg
        ext = os.path.splitext(url.split('?')[0])[1]
        if not ext or len(ext) > 5: # Handle weird URLs
            ext = '.jpg'
        
        filename += ext
        directory = os.path.join('images', 'legislators')
        filepath = os.path.join(directory, filename)
        
        # Don't redownload if it already exists and isn't empty
        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            return filepath
            
        # Ensure directory exists
        os.makedirs(directory, exist_ok=True)
            
        response = requests.get(url, stream=True, timeout=10)
        response.raise_for_status()
        
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return filepath
    except Exception as e:
        print(f"Error downloading image for {name} from {url}: {e}")
        return "N/A"

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

        # Find the table by its class
        legislators_table = soup.find('table', class_='leg-data')

        if not legislators_table:
            print("Error: Legislators table with class 'leg-data' not found.")
            return []

        # Find all table rows within the tbody
        tbody = legislators_table.find('tbody')
        if tbody and isinstance(tbody, Tag):
            table_rows = tbody.find_all('tr')
        else:
            table_rows = []

        # Process each legislator row
        for row in table_rows:
            # Name is in a 'th', others in 'td'
            cells = row.find_all(['td', 'th'])
            if len(cells) >= 4: # Ensure there are enough columns
                # Extract chamber information (Column 0: Title)
                chamber_text = cells[0].get_text(strip=True)
                chamber = "Senate" if "Senator" in chamber_text else "House"

                # Extract name and link (Column 1: Name)
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

                # Extract district number (Column 2: District)
                district = cells[2].get_text(strip=True)

                # Extract party affiliation (Column 3: Party)
                party = cells[3].get_text(strip=True)

                # --- Fetch detail page for committees, counties, and picture ---
                committees = []
                counties = []
                picture_url = "N/A"
                if legislator_link != "N/A":
                    try:
                        # Fetch the individual legislator's detail page
                        detail_resp = requests.get(legislator_link)
                        detail_resp.raise_for_status()
                        detail_soup = BeautifulSoup(detail_resp.text, 'html.parser')
                        
                        # Extract profile picture
                        img_elem = detail_soup.select_one('img.legislator-picture')
                        if img_elem and 'src' in img_elem.attrs:
                            picture_url = img_elem['src']
                            if not picture_url.startswith('http'):
                                picture_url = base_url + picture_url
                        
                        # Extract committee assignments
                        for cblock in detail_soup.select('.committee-tile-wrapper'):
                            cname_elem = cblock.select_one('.legislator-detail-committee-title span:last-of-type')
                            role_elem = cblock.select_one('.comm-mem-role')
                            cname = cname_elem.get_text(strip=True) if cname_elem else ""
                            role = role_elem.get_text(strip=True) if role_elem else ""
                            if cname:
                                committees.append({"name": cname, "role": role})
                        
                        # Extract counties served
                        for county_elem in detail_soup.select('.county-list li'):
                            county = county_elem.get_text(strip=True)
                            if county:
                                counties.append(county)
                        
                        # Be polite to the server with rate limiting
                        time.sleep(0.1)
                    except Exception as e:
                        print(f"Error fetching details for {name}: {e}")

                # Add this legislator's data to our collection
                local_picture = download_image(picture_url, name)

                legislators_data.append({
                    "District": district,
                    "Chamber": chamber,
                    "Name": name,
                    "Party": party,
                    "Link": legislator_link,
                    "Picture": local_picture,
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

        # Write the data to an external file as a json table that can be
        # read by a web application.
        df.to_json('legislators.json', orient='records')
        print(f"\nData saved to legislators.json")

        # Print the Markdown table for verification
        try:
            print("\nLegislator Summary:")
            print(df.to_markdown(index=False))
        except ImportError:
            print("Note: 'tabulate' library not found, skipping Markdown summary display.")

        # Read the data from the file and print it for verification
        with open('legislators.json', 'r') as file:
            data = json.load(file)
        print(f"Verified: {len(data)} records written to file")
    else:
        print("No data was fetched. Please check the website and try again.")


