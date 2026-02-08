# Colorado Legislative District Maps

This is an interactive web application that visualizes the legislative districts of the Colorado General Assembly (Senate and House) using Leaflet.js. It provides a clear, color-coded view of districts based on political party affiliation and offers detailed information about each legislator.

## Features

-   **Dual Interactive Maps**: Separate, fully interactive maps for both the Colorado Senate and House of Representatives.
-   **Color-Coded Districts**: Districts are color-coded by political party (Democrat, Republican, or other) for easy visual identification.
-   **Detailed Legislator Popups**: Clicking on a district reveals a popup with detailed information, including:
    -   **Profile Picture**: Official photograph of the legislator.
    -   Full name and party affiliation.
    -   Counties served within the district.
    -   Current committee assignments and roles.
-   **Toggleable Map Layers**: A layer control allows users to toggle geographical boundaries, including county lines.
-   **Interactive Overlays**: Click on a county to see its name in a popup.

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

## Setup and Usage

This project was developed with the assistance of an AI coding assistant, Gemini CLI. The AI was utilized for various tasks including code generation, scraping logic implementation, refactoring, and documentation.

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd co_legislators
    ```

2.  **Serve the files:**
    You need a simple local web server to run the `index.html` file. A common way to do this is with Python's built-in HTTP server.

    If you have Python 3:
    ```bash
    python -m http.server
    ```

    If you have Python 2:
    ```bash
    python -m SimpleHTTPServer
    ```

    Alternatively, you can use the Live Server extension for Visual Studio Code.

3.  **Open in your browser:**
    Navigate to `http://localhost:8000` (or the port specified by your server) in your web browser to view the maps.