// Cursor inside a loop body: later body statements (including the
// increment of a manual counter) are skipped, so iterations continue
// until the loop condition or the iteration limit stops them.
//@line 9
//@line 10
//@line 999
double total = 0;
int m = 0;
for (int i = 0; i < 4; i++) {
    total += i;
    makeSimpleTube(FdPoint3d(i, 0, 0), FdPoint3d(i, 1, 0), 1, 1, 3);
}
for (; m < 3;) {
    total += 100;
    m++;
}
double doneTotal = total;
