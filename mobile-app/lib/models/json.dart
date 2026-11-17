/// Small readers that tolerate missing or mistyped fields from the API.
typedef Json = Map<String, dynamic>;

String str(Json json, String key, [String fallback = '']) =>
    json[key] is String ? json[key] as String : fallback;
String? strOrNull(Json json, String key) => json[key] is String ? json[key] as String : null;
double num_(Json json, String key) => json[key] is num ? (json[key] as num).toDouble() : 0;
double? numOrNull(Json json, String key) => json[key] is num ? (json[key] as num).toDouble() : null;
int int_(Json json, String key) => json[key] is num ? (json[key] as num).toInt() : 0;
List<Json> objects(Json json, String key) =>
    json[key] is List ? (json[key] as List).whereType<Map<String, dynamic>>().toList() : const [];
List<String> strings(Json json, String key) =>
    json[key] is List ? (json[key] as List).whereType<String>().toList() : const [];
DateTime? dateOrNull(Json json, String key) =>
    json[key] is String ? DateTime.tryParse(json[key] as String) : null;
