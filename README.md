# Colorado Legislative District Maps

This is an interactive web application that visualizes the legislative districts of the Colorado General Assembly (Senate and House) using Leaflet.js. It provides a clear, color-coded view of districts based on political party affiliation and offers detailed information about each legislator.

## Features

-   **Dual Interactive Maps**: Separate, fully interactive maps for both the Colorado Senate and House of Representatives.
-   **Instant Search & Zoom**: Search bar with real-time autocomplete for legislators, districts (e.g. *SD 18*, *HD 10*), and ZIP codes (e.g. *80302*). Selecting an item smoothly flies to the district with generous context padding.
-   **Color-Coded Districts**: Districts are color-coded by political party (Democrat, Republican, or other) for easy visual identification.
-   **Detailed Legislator Popups**: Clicking on a district reveals a popup with detailed information, including:
    -   **Profile Picture**: Official photograph of the legislator.
    -   Full name and party affiliation.
    -   Counties served within the district.
    -   Current committee assignments and roles.
-   **Toggleable Basemaps & Overlays**: Choose between OpenStreetMap (with street names and building footprints for canvassing), Esri World Street Map, Satellite with Streets, and CARTO Voyager.
-   **County & ZIP Code Boundaries**: Toggleable county lines and dotted purple ZIP code boundary layers, with on-map ZIP code badges at neighborhood zoom levels.
-   **Pole of Inaccessibility Centering**: District labels and popups use the `polylabel` algorithm to visually center labels strictly within irregular or concave district boundaries.

## Data Processing

To refresh the legislator data and download the latest profile pictures:

1.  **Install dependencies**:
    ```bash
    pip install requests beautifulsoup4 pandas
    ```
2.  **Run the scraper**:
    ```bash
    python legs.py
    ```
    This script will update `legislators.json` and download images to `images/legislators/`.
3.  **Validate the data**:
    ```bash
    python check_legislators.py
    ```

## Data Sources and Citations

The application relies on several data sources to visualize the legislative landscape of Colorado:

-   **Legislator Information & Pictures (`legislators.json`, `images/`):** Scraped from the official [Colorado General Assembly website](https://leg.colorado.gov/legislators).
-   **District Boundaries (`senate_coords.json`, `house_coords.json`):** Based on the 2021 approved redistricting plans from the Colorado Independent Redistricting Commissions.
-   **County Boundaries (`colorado_counties.geojson`):** Derived from the U.S. Census Bureau's TIGER/Line Shapefiles.
-   **ZIP Code Boundaries (`colorado_zip_codes.geojson`):** Derived from U.S. Census Bureau ZCTA data.

## Setup and Usage

1.  **Clone the repository:**
    ```bash
    git clone git@github.com:HenryStiles/co_legislators.git
    cd co_legislators
    ```

2.  **Serve the files:**
    You need a local web server to run the `index.html` file due to CORS restrictions on local JSON files.
    
    Using the included development server (with no-cache headers enabled):
    ```bash
    python server.py 8001
    ```
    Or Python's built-in server:
    ```bash
    python -m http.server 8000
    ```

3.  **Open in your browser:**
    Navigate to `http://localhost:8001` (or the port specified by your server) in your web browser to view the maps.