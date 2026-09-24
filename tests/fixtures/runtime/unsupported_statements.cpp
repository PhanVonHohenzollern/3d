// Statements outside the supported subset: while/do/switch/break/continue.
//@line 999
//@line 7
int i = 0;
double acc = 0;
while (i < 3) { acc += 1; i++; } acc = acc + 100;
do { acc += 2; } while (acc < 10);
switch (i) { case 0: acc = 5; break; default: acc = 6; }
for (int k = 0; k < 3; k++) {
    if (k == 1) continue;
    acc += k;
    if (k == 2) break;
}
break;
continue;
goto label;
label: acc = 7;
std::string name = "x";
auto autoVar = 5;
static double st = 2;
unsigned int ui = 4;
struct S { int a; };
return;
acc = 1000;
