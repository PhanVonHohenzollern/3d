// for loops: clauses, nesting, cursor inside the body, loop limit.
//@line 999
//@line 8
//@line 12
//@line 18
double sum = 0;
for (int i = 0; i < 5; i++) {
    sum += i;
    double sq = i * i;
    makeSimpleTube(FdPoint3d(i, 0, 0), FdPoint3d(i, sq, 0), 1, 1, 3);
}
double afterLoop = i;
for (int j = 10; j > 0; j -= 3) sum = sum + j;
for (int r = 0; r < 3; ++r)
    for (int c = 0; c < 2; c++) {
        sum += r * c;
    }
int k = 0;
for (; k < 3;) k++;
for (k = 0; k < 2; k = k + 1) ;
for (double t = 0; t < 1; t += 0.25) sum += t;
for (int n = 0; n < 3; n++) {
    if (n == 1) sum = sum * 10;
}
for (int e = 0; e < 3; e++) sum += 1 / (e - 1);
for (int bad = 0; bad < unknownLimit; bad++) sum += 1;
for (int z = 0; z < 0; z++) sum = -1;
int count = 0;
for (;;) {
    count++;
}
for (int w = 0; w < 3; w--) count = count;
double final = sum;
