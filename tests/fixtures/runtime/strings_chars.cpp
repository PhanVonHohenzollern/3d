// Strings, chars and conversions.
//@line 999
char *a = "hello";
char *b = a + " world";
const char *c = "x";
char d = 'q';
char *e = 'multi';
bool eq = a == "hello";
bool lt = a < b;
int cmp = strcmp(a, b);
double conv = a;
bool truthy = "";
bool truthy2 = "0";
char *fromNum = 42;
char *fromDouble = 1.5;
char *fromPoint = FdPoint3d(1, 2, 3);
char *fromBool = true;
char *arr[3] = {"a", "b"};
arr[2] = "c";
arr[0] = 5;
char *esc = "tab\there \"quoted\" back\\slash";
char *multi = "line1
line2";
double afterMulti = 1;
char *unicode = "café";
foo(a, d, esc, unicode);
