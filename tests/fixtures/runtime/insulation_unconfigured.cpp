// Without configuration the queries return false and write nothing.
//@eval getIntInsSize(ins)
double ins = 3;
double r = 0;
if (getExtInsSize(ins)) r = 1;
else r = 2;
if (getIntInsSize(unknownDest)) r = 3;
bool q = getIntInsSize(ins) || getExtInsSize(ins);
