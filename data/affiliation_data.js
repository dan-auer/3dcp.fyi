/* affiliation_data.js - window.AFFILIATIONS_DATA: where each institution is,
 * keyed by its ROR ID without the https://ror.org/ prefix.
 *
 * RECORD TEMPLATE:
 *   "02kkvpp62": {
 *     "city": "Munich",
 *     "country": "Germany",
 *     "lat": 48.1374,
 *     "lon": 11.5755,
 *     "name": "Technical University of Munich"
 *   }
 *
 * From the ROR registry (ror.org, CC0), fetched 2026-10-03. name is ROR's
 * display name. city, country, lat and lon are ROR's GeoNames location - the
 * city's centre, not the campus, so institutions in one city share one point.
 * lat / lon in decimal degrees, north and east positive. country is GeoNames'
 * English name; the map matches it to its outlines (affiliation-map.js ALIAS).
 * To add an institution: https://api.ror.org/v2/organizations/<ROR ID> gives
 * the names[] entry typed "ror_display" and locations[0].geonames_details
 * (name -> city, country_name -> country, lat, lng -> lon).
 */
window.AFFILIATIONS_DATA = {
  "02e2c7k09": { "city": "Delft", "country": "The Netherlands", "lat": 52.0067, "lon": 4.3556, "name": "Delft University of Technology" },
  "02c2kyt77": { "city": "Eindhoven", "country": "The Netherlands", "lat": 51.4408, "lon": 5.4778, "name": "Eindhoven University of Technology" },
  "05a28rw58": { "city": "Zurich", "country": "Switzerland", "lat": 47.3667, "lon": 8.55, "name": "ETH Zurich" },
  "00cv9y106": { "city": "Ghent", "country": "Belgium", "lat": 51.05, "lon": 3.7167, "name": "Ghent University" },
  "0030zas98": { "city": "Hong Kong", "country": "Hong Kong", "lat": 22.2783, "lon": 114.1747, "name": "Hong Kong Polytechnic University" },
  "05htk5m33": { "city": "Changsha", "country": "China", "lat": 28.1987, "lon": 112.9709, "name": "Hunan University" },
  "03v0r5n49": { "city": "Chennai", "country": "India", "lat": 13.0878, "lon": 80.2785, "name": "Indian Institute of Technology Madras" },
  "05apxxy63": { "city": "Daejeon", "country": "South Korea", "lat": 36.3491, "lon": 127.3849, "name": "Korea Advanced Institute of Science and Technology" },
  "04vg4w365": { "city": "Loughborough", "country": "United Kingdom", "lat": 52.7667, "lon": -1.2, "name": "Loughborough University" },
  "02bfwt286": { "city": "Melbourne", "country": "Australia", "lat": -37.814, "lon": 144.9633, "name": "Monash University" },
  "012k1v959": { "city": "Munich", "country": "Germany", "lat": 48.1374, "lon": 11.5755, "name": "Munich University of Applied Sciences" },
  "02e7b5302": { "city": "Singapore", "country": "Singapore", "lat": 1.2897, "lon": 103.8501, "name": "Nanyang Technological University" },
  "01nffqt88": { "city": "Milan", "country": "Italy", "lat": 45.4643, "lon": 9.1895, "name": "Politecnico di Milano" },
  "00hx57361": { "city": "Princeton", "country": "United States", "lat": 40.3487, "lon": -74.659, "name": "Princeton University" },
  "04ct4d772": { "city": "Nanjing", "country": "China", "lat": 32.0617, "lon": 118.7778, "name": "Southeast University" },
  "05bk57929": { "city": "Stellenbosch", "country": "South Africa", "lat": -33.9346, "lon": 18.8668, "name": "Stellenbosch University" },
  "031rekg67": { "city": "Melbourne", "country": "Australia", "lat": -37.814, "lon": 144.9633, "name": "Swinburne University of Technology" },
  "04qtj9h94": { "city": "Kongens Lyngby", "country": "Denmark", "lat": 55.7704, "lon": 12.5038, "name": "Technical University of Denmark" },
  "02kkvpp62": { "city": "Munich", "country": "Germany", "lat": 48.1374, "lon": 11.5755, "name": "Technical University of Munich" },
  "010nsgg66": { "city": "Braunschweig", "country": "Germany", "lat": 52.2659, "lon": 10.5267, "name": "Technische Universität Braunschweig" },
  "042aqky30": { "city": "Dresden", "country": "Germany", "lat": 51.0509, "lon": 13.7383, "name": "Technische Universität Dresden" },
  "01f5ytq51": { "city": "College Station", "country": "United States", "lat": 30.628, "lon": -96.3344, "name": "Texas A&M University" },
  "03rc6as71": { "city": "Shanghai", "country": "China", "lat": 31.2222, "lon": 121.4581, "name": "Tongji University" },
  "03cve4549": { "city": "Beijing", "country": "China", "lat": 39.9075, "lon": 116.3972, "name": "Tsinghua University" },
  "03taz7m60": { "city": "Los Angeles", "country": "United States", "lat": 34.0522, "lon": -118.2437, "name": "University of Southern California" }
};
