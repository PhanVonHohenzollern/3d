// Malformed and unusual #define lines.
#define
#define   
#define (x) x
#define F(x x
#define G(x) 
#define H(a,,b) (a + b)
#define I( ) 5
#define J(x)x*2
#define K 1 +
#define L unknownFn(2)
#define M "str" 
	#define TABBED 4
double h = H(1, 2);
double i = I();
double j = J(3);
double k = K;
double tabbed = TABBED;
char *m = M;
