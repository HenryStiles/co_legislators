import requests
from bs4 import BeautifulSoup, Tag
import pandas as pd # Using pandas for easy table creation and display
import json

def scrape_legislator_data(url):
    """
    Scrapes legislator data (district, chamber, link) from the provided URL.

    Args:
        url (str): The URL of the webpage to scrape.

    Returns:
        list: A list of dictionaries, where each dictionary represents a legislator
              with 'District', 'Chamber', and 'Link' keys.
    """
    legislators_data = []
    base_url = "https://leg.colorado.gov" # Base URL for constructing absolute links

    try:
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

        for row in table_rows:
            cells = row.find_all('td')
            if len(cells) >= 4: # Ensure there are enough columns
                chamber_text = cells[0].get_text(strip=True)
                chamber = "Senate" if "Senator" in chamber_text else "House"

                # Only include Senate members
                if chamber != "Senate":
                    continue

                # Name from the <a> tag in the second column
                name_elem = cells[1].find('a')
                name = name_elem.get_text(strip=True) if name_elem else "N/A"

                # Link from the <a> tag in the second column
                legislator_link = "N/A"
                if name_elem and 'href' in name_elem.attrs:
                    relative_link = name_elem['href']
                    if not relative_link.startswith('http'):
                        legislator_link = base_url + relative_link
                    else:
                        legislator_link = relative_link

                # District from the third column
                district_elem = cells[2].find('div', class_='field-content')
                district = district_elem.get_text(strip=True) if district_elem else "N/A"

                # Party from the fourth column
                party_elem = cells[3].find('div', class_='field-content')
                party = party_elem.get_text(strip=True) if party_elem else "N/A"

                legislators_data.append({
                    "District": district,
                    "Chamber": chamber,
                    "Name": name,
                    "Party": party,
                    "Link": legislator_link
                })
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from {url}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    return legislators_data

# URL of the webpage to scrape
target_url = "https://leg.colorado.gov/legislators"

# Scrape the live webpage content
scraped_data = scrape_legislator_data(target_url)

# Convert to Pandas DataFrame for easy table formatting
df = pd.DataFrame(scraped_data)

# Print the Markdown table
print(df.to_markdown(index=False))

# write the data to an external file as a json table that can be
# read by a web application.
df.to_json('legislators.json', orient='records')

# read the data from the file and print it
with open('legislators.json', 'r') as file:
    data = json.load(file)
    print(data)


